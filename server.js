require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const driveLib = require('./lib/drive');
const db = require('./lib/db');
const vehicleApi = require('./lib/vehicleApi');

const app = express();
const PORT = process.env.PORT || 3000;
const MPG_US_PER_KM_PER_L = 2.3521;

function resolveCommit() {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return require('child_process').execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const COMMIT = resolveCommit();
const DEPLOYED_AT = new Date().toISOString();

app.set('trust proxy', 1);

app.use(express.json());
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
    maxAge: 180 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
);
app.use(express.static(path.join(__dirname, 'public')));

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

function computeAveragesByCar(cars, entries) {
  const byCarId = new Map();
  for (const e of entries) {
    const key = e.carId === null || e.carId === undefined ? 'none' : String(e.carId);
    if (!byCarId.has(key)) byCarId.set(key, []);
    byCarId.get(key).push(e);
  }

  const result = cars.map((c) => ({
    carId: c.id,
    carName: c.name,
    average: computeAverage(byCarId.get(String(c.id)) || []),
  }));

  const unassigned = byCarId.get('none');
  if (unassigned && unassigned.length > 0) {
    result.push({ carId: null, carName: 'No car', average: computeAverage(unassigned) });
  }

  return result;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  next();
}

const ISSUE_STATUSES = ['new', 'in_progress', 'resolved', 'wont_fix'];

function isDeveloper(email) {
  return Boolean(process.env.DEVELOPERS_EMAIL) && email === process.env.DEVELOPERS_EMAIL;
}

function requireDeveloper(req, res, next) {
  if (!isDeveloper(req.session.email)) {
    return res.status(403).json({ error: 'Only the developer can do this.' });
  }
  next();
}

function handleDbError(req, res, err, fallbackMessage) {
  console.error(fallbackMessage, err.message);
  res.status(502).json({ error: fallbackMessage });
}

app.get('/auth/google', (req, res) => {
  if (!driveLib.isEnvConfigured()) {
    return res.status(500).send('Google OAuth is not configured on the server (missing env vars).');
  }
  const oauth2Client = driveLib.createOAuthClient();
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(driveLib.getAuthUrl(oauth2Client, state));
});

app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Google sign-in failed: ${error}`);
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state. Please try signing in again.');
  }
  delete req.session.oauthState;

  try {
    const oauth2Client = driveLib.createOAuthClient();
    const tokens = await driveLib.exchangeCode(oauth2Client, code);
    oauth2Client.setCredentials(tokens);
    const email = await driveLib.getEmail(oauth2Client);

    req.session.tokens = tokens;
    req.session.email = email;

    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    res.status(500).send('Sign-in failed. Please try again.');
  }
});

app.post('/auth/logout', (req, res) => {
  req.session = null;
  res.status(204).end();
});

app.get('/api/version', (req, res) => {
  res.json({ commit: COMMIT.slice(0, 7), deployedAt: DEPLOYED_AT });
});

app.get('/api/session', (req, res) => {
  const authenticated = Boolean(req.session && req.session.tokens);
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'test';
  res.json({
    authenticated,
    email: authenticated ? req.session.email : null,
    environment,
    isDeveloper: authenticated && isDeveloper(req.session.email),
  });
});

app.get('/api/cars', requireAuth, async (req, res) => {
  try {
    const cars = await db.getCars(req.session.email);
    res.json({ cars });
  } catch (err) {
    handleDbError(req, res, err, 'Could not load cars from the database.');
  }
});

function validateCarInput(body) {
  const name = String(body.name || '').trim();
  const make = String(body.make || '').trim() || null;
  const model = String(body.model || '').trim() || null;
  const yearRaw = body.year;
  const year = yearRaw === undefined || yearRaw === null || yearRaw === '' ? null : Number(yearRaw);

  if (!name) return { error: 'Car name is required.' };
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    return { error: 'Year must be a valid year.' };
  }
  return { car: { name, make, model, year } };
}

app.post('/api/cars', requireAuth, async (req, res) => {
  const { car, error } = validateCarInput(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const saved = await db.addCar(req.session.email, car);
    if (car.make && car.model) {
      const cached = await db.getCarModels(car.make);
      if (!cached.includes(car.model)) {
        await db.cacheCarModels(car.make, [car.model]);
      }
    }
    const cars = await db.getCars(req.session.email);
    res.status(201).json({ cars, car: saved });
  } catch (err) {
    handleDbError(req, res, err, 'Could not save car to the database.');
  }
});

app.put('/api/cars/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid car id.' });
  }
  const { car, error } = validateCarInput(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const updated = await db.updateCar(req.session.email, id, car);
    if (!updated) return res.status(404).json({ error: 'Car not found.' });
    const cars = await db.getCars(req.session.email);
    res.json({ cars, car: updated });
  } catch (err) {
    handleDbError(req, res, err, 'Could not update car in the database.');
  }
});

app.delete('/api/cars/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid car id.' });
  }

  try {
    const deleted = await db.deleteCar(req.session.email, id);
    if (!deleted) return res.status(404).json({ error: 'Car not found.' });
    const cars = await db.getCars(req.session.email);
    res.json({ cars });
  } catch (err) {
    handleDbError(req, res, err, 'Could not delete car from the database.');
  }
});

app.get('/api/car-makes', requireAuth, async (req, res) => {
  try {
    const makes = await db.getCarMakes();
    res.json({ makes });
  } catch (err) {
    handleDbError(req, res, err, 'Could not load makes from the database.');
  }
});

app.get('/api/car-models', requireAuth, async (req, res) => {
  const make = String(req.query.make || '').trim();
  if (!make) return res.status(400).json({ error: 'make is required.' });

  try {
    let models = await db.getCarModels(make);
    if (models.length === 0) {
      const fetched = await vehicleApi.fetchModelsForMake(make);
      if (fetched.length > 0) {
        await db.cacheCarModels(make, fetched);
        models = await db.getCarModels(make);
      }
    }
    res.json({ models });
  } catch (err) {
    handleDbError(req, res, err, 'Could not load models from the database.');
  }
});

app.get('/api/issues', requireAuth, async (req, res) => {
  try {
    const issues = isDeveloper(req.session.email)
      ? await db.getAllIssues()
      : await db.getIssuesForUser(req.session.email);
    res.json({ issues });
  } catch (err) {
    handleDbError(req, res, err, 'Could not load issues from the database.');
  }
});

app.post('/api/issues', requireAuth, async (req, res) => {
  const description = String(req.body.description || '').trim();
  if (!description) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  try {
    await db.addIssue(req.session.email, description);
    const issues = await db.getIssuesForUser(req.session.email);
    res.status(201).json({ issues });
  } catch (err) {
    handleDbError(req, res, err, 'Could not save issue to the database.');
  }
});

app.put('/api/issues/:id', requireAuth, requireDeveloper, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid issue id.' });
  }
  const status = String(req.body.status || '');
  if (!ISSUE_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ISSUE_STATUSES.join(', ')}.` });
  }

  try {
    const updated = await db.updateIssueStatus(id, status);
    if (!updated) return res.status(404).json({ error: 'Issue not found.' });
    const issues = await db.getAllIssues();
    res.json({ issues });
  } catch (err) {
    handleDbError(req, res, err, 'Could not update issue in the database.');
  }
});

app.delete('/api/issues/:id', requireAuth, requireDeveloper, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid issue id.' });
  }

  try {
    const deleted = await db.deleteIssue(id);
    if (!deleted) return res.status(404).json({ error: 'Issue not found.' });
    const issues = await db.getAllIssues();
    res.json({ issues });
  } catch (err) {
    handleDbError(req, res, err, 'Could not delete issue from the database.');
  }
});

app.get('/api/entries', requireAuth, async (req, res) => {
  try {
    const [entries, cars] = await Promise.all([
      db.getEntries(req.session.email),
      db.getCars(req.session.email),
    ]);
    res.json({ entries, carAverages: computeAveragesByCar(cars, entries), email: req.session.email });
  } catch (err) {
    handleDbError(req, res, err, 'Could not load entries from the database.');
  }
});

function validateEntryFields(body) {
  const startKm = Number(body.startKm);
  const endKm = Number(body.endKm);
  const liters = Number(body.liters);
  const carId = Number(body.carId);

  if (!Number.isFinite(startKm) || !Number.isFinite(endKm) || !Number.isFinite(liters)) {
    return { error: 'startKm, endKm, and liters must be numbers.' };
  }
  if (endKm <= startKm) {
    return { error: 'End KM must be greater than Start KM.' };
  }
  if (liters <= 0) {
    return { error: 'Total fuel must be greater than 0.' };
  }
  if (!Number.isInteger(carId) || carId < 0) {
    return { error: 'Please select a car.' };
  }

  const distance = round(endKm - startKm);
  return { fields: { startKm, endKm, liters, carId, distance, ...conversions(distance / liters) } };
}

app.post('/api/entries', requireAuth, async (req, res) => {
  const { fields, error } = validateEntryFields(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const car = await db.getCarById(req.session.email, fields.carId);
    if (!car) return res.status(400).json({ error: 'Selected car was not found.' });

    const entry = { ...fields, date: new Date().toISOString().slice(0, 10) };
    const entries = await db.addEntry(req.session.email, entry);
    const cars = await db.getCars(req.session.email);
    res.status(201).json({ entries, carAverages: computeAveragesByCar(cars, entries) });
  } catch (err) {
    handleDbError(req, res, err, 'Could not save entry to the database.');
  }
});

app.put('/api/entries/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 0) {
    return res.status(400).json({ error: 'Invalid entry id.' });
  }

  const { fields, error } = validateEntryFields(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const car = await db.getCarById(req.session.email, fields.carId);
    if (!car) return res.status(400).json({ error: 'Selected car was not found.' });

    const entries = await db.updateEntry(req.session.email, id, fields);
    if (!entries) return res.status(404).json({ error: 'Entry not found.' });
    const cars = await db.getCars(req.session.email);
    res.json({ entries, carAverages: computeAveragesByCar(cars, entries) });
  } catch (err) {
    handleDbError(req, res, err, 'Could not update entry in the database.');
  }
});

app.delete('/api/entries/:index', requireAuth, async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid entry index.' });
  }

  try {
    const entries = await db.deleteEntryAtIndex(req.session.email, index);
    if (entries === null) {
      return res.status(404).json({ error: 'Entry not found.' });
    }
    const cars = await db.getCars(req.session.email);
    res.json({ entries, carAverages: computeAveragesByCar(cars, entries) });
  } catch (err) {
    handleDbError(req, res, err, 'Could not delete entry from the database.');
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KilometersToLiter running at ${process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`}`);
    if (!driveLib.isEnvConfigured()) {
      console.warn(
        'Google OAuth env vars are not fully set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET). Sign-in will not work until they are.'
      );
    }
  });
}

module.exports = app;
