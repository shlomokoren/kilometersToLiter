const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => console.error('Unexpected PG pool error', err.message));
  }
  return pool;
}

let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `
        CREATE TABLE IF NOT EXISTS entries (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          start_km DOUBLE PRECISION NOT NULL,
          end_km DOUBLE PRECISION NOT NULL,
          liters DOUBLE PRECISION NOT NULL,
          distance DOUBLE PRECISION NOT NULL,
          km_per_l DOUBLE PRECISION NOT NULL,
          l_per_100km DOUBLE PRECISION NOT NULL,
          mpg_us DOUBLE PRECISION NOT NULL,
          entry_date TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS entries_email_id_idx ON entries (email, id);
        `
      )
      .catch((err) => {
        schemaReady = undefined;
        throw err;
      });
  }
  return schemaReady;
}

function rowToEntry(row) {
  return {
    startKm: row.start_km,
    endKm: row.end_km,
    liters: row.liters,
    distance: row.distance,
    kmPerL: row.km_per_l,
    lPer100km: row.l_per_100km,
    mpgUs: row.mpg_us,
    date: row.entry_date,
  };
}

async function getEntries(email) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT * FROM entries WHERE email = $1 ORDER BY id ASC',
    [email]
  );
  return rows.map(rowToEntry);
}

async function addEntry(email, entry) {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO entries (email, start_km, end_km, liters, distance, km_per_l, l_per_100km, mpg_us, entry_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      email,
      entry.startKm,
      entry.endKm,
      entry.liters,
      entry.distance,
      entry.kmPerL,
      entry.lPer100km,
      entry.mpgUs,
      entry.date,
    ]
  );
  return getEntries(email);
}

async function deleteEntryAtIndex(email, index) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT id FROM entries WHERE email = $1 ORDER BY id ASC OFFSET $2 LIMIT 1',
    [email, index]
  );
  if (rows.length === 0) return null;
  await getPool().query('DELETE FROM entries WHERE id = $1', [rows[0].id]);
  return getEntries(email);
}

module.exports = {
  getEntries,
  addEntry,
  deleteEntryAtIndex,
};
