const { Pool } = require('pg');
const carCatalogSeed = require('./carCatalogSeed');

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
        CREATE TABLE IF NOT EXISTS cars (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          make TEXT,
          model TEXT,
          year INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS cars_email_id_idx ON cars (email, id);
        ALTER TABLE cars ALTER COLUMN make DROP NOT NULL;
        ALTER TABLE cars ALTER COLUMN model DROP NOT NULL;

        CREATE TABLE IF NOT EXISTS car_catalog (
          make TEXT NOT NULL,
          model TEXT NOT NULL,
          PRIMARY KEY (make, model)
        );

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
        ALTER TABLE entries ADD COLUMN IF NOT EXISTS car_id BIGINT REFERENCES cars(id) ON DELETE SET NULL;

        CREATE TABLE IF NOT EXISTS issues (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'new',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS issues_email_id_idx ON issues (email, id);
        `
      )
      .then(() => seedCarCatalog())
      .catch((err) => {
        schemaReady = undefined;
        throw err;
      });
  }
  return schemaReady;
}

function seedCarCatalog() {
  const values = [];
  const params = [];
  let i = 1;
  for (const { make, models } of carCatalogSeed) {
    for (const model of models) {
      values.push(`($${i++}, $${i++})`);
      params.push(make, model);
    }
  }
  return getPool().query(
    `INSERT INTO car_catalog (make, model) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params
  );
}

function rowToEntry(row) {
  return {
    id: row.id,
    startKm: row.start_km,
    endKm: row.end_km,
    liters: row.liters,
    distance: row.distance,
    kmPerL: row.km_per_l,
    lPer100km: row.l_per_100km,
    mpgUs: row.mpg_us,
    date: row.entry_date,
    carId: row.car_id,
    carName: row.car_name,
    carMake: row.car_make,
    carModel: row.car_model,
    carYear: row.car_year,
  };
}

function rowToCar(row) {
  return {
    id: row.id,
    name: row.name,
    make: row.make,
    model: row.model,
    year: row.year,
  };
}

async function getEntries(email) {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT entries.*, cars.name AS car_name, cars.make AS car_make, cars.model AS car_model, cars.year AS car_year
     FROM entries
     LEFT JOIN cars ON cars.id = entries.car_id
     WHERE entries.email = $1
     ORDER BY entries.id ASC`,
    [email]
  );
  return rows.map(rowToEntry);
}

async function addEntry(email, entry) {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO entries (email, start_km, end_km, liters, distance, km_per_l, l_per_100km, mpg_us, entry_date, car_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
      entry.carId,
    ]
  );
  return getEntries(email);
}

async function updateEntry(email, id, entry) {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `UPDATE entries
     SET start_km = $1, end_km = $2, liters = $3, distance = $4,
         km_per_l = $5, l_per_100km = $6, mpg_us = $7, car_id = $8
     WHERE email = $9 AND id = $10`,
    [
      entry.startKm,
      entry.endKm,
      entry.liters,
      entry.distance,
      entry.kmPerL,
      entry.lPer100km,
      entry.mpgUs,
      entry.carId,
      email,
      id,
    ]
  );
  if (rowCount === 0) return null;
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

async function getCars(email) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT * FROM cars WHERE email = $1 ORDER BY id ASC',
    [email]
  );
  return rows.map(rowToCar);
}

async function getCarById(email, id) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT * FROM cars WHERE email = $1 AND id = $2',
    [email, id]
  );
  return rows[0] ? rowToCar(rows[0]) : null;
}

async function addCar(email, car) {
  await ensureSchema();
  const { rows } = await getPool().query(
    `INSERT INTO cars (email, name, make, model, year)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email, car.name, car.make, car.model, car.year]
  );
  return rowToCar(rows[0]);
}

async function updateCar(email, id, car) {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE cars SET name = $1, make = $2, model = $3, year = $4
     WHERE email = $5 AND id = $6
     RETURNING *`,
    [car.name, car.make, car.model, car.year, email, id]
  );
  return rows[0] ? rowToCar(rows[0]) : null;
}

async function deleteCar(email, id) {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    'DELETE FROM cars WHERE email = $1 AND id = $2',
    [email, id]
  );
  return rowCount > 0;
}

async function getCarMakes() {
  await ensureSchema();
  const { rows } = await getPool().query('SELECT DISTINCT make FROM car_catalog ORDER BY make');
  return rows.map((r) => r.make);
}

async function getCarModels(make) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT model FROM car_catalog WHERE make = $1 ORDER BY model',
    [make]
  );
  return rows.map((r) => r.model);
}

async function cacheCarModels(make, models) {
  if (models.length === 0) return;
  await ensureSchema();
  const values = [];
  const params = [make];
  let i = 2;
  for (const model of models) {
    values.push(`($1, $${i++})`);
    params.push(model);
  }
  await getPool().query(
    `INSERT INTO car_catalog (make, model) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params
  );
}

function rowToIssue(row) {
  return {
    id: row.id,
    email: row.email,
    description: row.description,
    status: row.status,
    date: row.created_at,
  };
}

async function getIssuesForUser(email) {
  await ensureSchema();
  const { rows } = await getPool().query(
    'SELECT * FROM issues WHERE email = $1 ORDER BY id DESC',
    [email]
  );
  return rows.map(rowToIssue);
}

async function getAllIssues() {
  await ensureSchema();
  const { rows } = await getPool().query('SELECT * FROM issues ORDER BY id DESC');
  return rows.map(rowToIssue);
}

async function addIssue(email, description) {
  await ensureSchema();
  const { rows } = await getPool().query(
    `INSERT INTO issues (email, description) VALUES ($1, $2) RETURNING *`,
    [email, description]
  );
  return rowToIssue(rows[0]);
}

async function updateIssueStatus(id, status) {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE issues SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] ? rowToIssue(rows[0]) : null;
}

async function deleteIssue(id) {
  await ensureSchema();
  const { rowCount } = await getPool().query('DELETE FROM issues WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  getEntries,
  addEntry,
  updateEntry,
  deleteEntryAtIndex,
  getCars,
  getCarById,
  addCar,
  updateCar,
  deleteCar,
  getCarMakes,
  getCarModels,
  cacheCarModels,
  getIssuesForUser,
  getAllIssues,
  addIssue,
  updateIssueStatus,
  deleteIssue,
};
