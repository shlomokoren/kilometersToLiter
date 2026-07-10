const express = require('express');
const fs = require('fs');
const path = require('path');
const drive = require('./lib/drive');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const MPG_US_PER_KM_PER_L = 2.3521;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readEntries() {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return raw.trim() ? JSON.parse(raw) : [];
}

function writeEntries(entries) {
  fs.writeFileSync(DB_PATH, JSON.stringify(entries, null, 2));
}

function conversions(kmPerL) {
  return {
    kmPerL: round(kmPerL),
    lPer100km: round(100 / kmPerL),
    mpgUs: round(kmPerL * MPG_US_PER_KM_PER_L),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function computeAverage(entries) {
  if (entries.length === 0) return null;
  const totalDistance = entries.reduce((sum, e) => sum + e.distance, 0);
  const totalLiters = entries.reduce((sum, e) => sum + e.liters, 0);
  return conversions(totalDistance / totalLiters);
}

app.get('/api/entries', (req, res) => {
  const entries = readEntries();
  res.json({ entries, average: computeAverage(entries), driveConfigured: drive.isConfigured() });
});

app.post('/api/entries', async (req, res) => {
  const startKm = Number(req.body.startKm);
  const endKm = Number(req.body.endKm);
  const liters = Number(req.body.liters);

  if (!Number.isFinite(startKm) || !Number.isFinite(endKm) || !Number.isFinite(liters)) {
    return res.status(400).json({ error: 'startKm, endKm, and liters must be numbers.' });
  }
  if (endKm <= startKm) {
    return res.status(400).json({ error: 'End KM must be greater than Start KM.' });
  }
  if (liters <= 0) {
    return res.status(400).json({ error: 'Total fuel must be greater than 0.' });
  }

  const distance = round(endKm - startKm);
  const entry = {
    startKm,
    endKm,
    liters,
    distance,
    ...conversions(distance / liters),
    date: new Date().toISOString().slice(0, 10),
  };

  const entries = readEntries();
  entries.push(entry);
  writeEntries(entries);

  let synced = false;
  let syncError = null;
  if (drive.isConfigured()) {
    try {
      await drive.pushEntries(entries);
      synced = true;
    } catch (err) {
      syncError = err.message;
      console.error('Drive sync failed:', err.message);
    }
  }

  res.status(201).json({ entries, average: computeAverage(entries), synced, syncError });
});

async function start() {
  if (drive.isConfigured()) {
    try {
      console.log('Pulling latest entries from Google Drive...');
      const remoteEntries = await drive.pullEntries();
      writeEntries(remoteEntries);
      console.log(`Synced ${remoteEntries.length} entries from Drive.`);
    } catch (err) {
      console.error('Could not pull from Drive, using local data instead:', err.message);
    }
  } else {
    console.log('Google Drive is not configured yet — see SETUP.md. Running with local data only.');
  }

  app.listen(PORT, () => {
    console.log(`KilometersToLiter running at http://localhost:${PORT}`);
  });
}

start();
