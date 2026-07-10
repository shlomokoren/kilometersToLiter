require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const driveLib = require('./lib/drive');

const app = express();
const PORT = process.env.PORT || 3000;
const MPG_US_PER_KM_PER_L = 2.3521;

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

function requireAuth(req, res, next) {
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  next();
}

function driveClientForRequest(req) {
  const { drive } = driveLib.driveFor(req.session.tokens, (tokens) => {
    req.session.tokens = tokens;
  });
  return drive;
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
    delete req.session.driveFileId;

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

app.get('/api/session', (req, res) => {
  const authenticated = Boolean(req.session && req.session.tokens);
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'test';
  res.json({ authenticated, email: authenticated ? req.session.email : null, environment });
});

app.get('/api/entries', requireAuth, async (req, res) => {
  try {
    const drive = driveClientForRequest(req);
    const fileId = await driveLib.ensureRemoteFile(drive, req.session.driveFileId);
    req.session.driveFileId = fileId;
    const entries = await driveLib.downloadEntries(drive, fileId);
    res.json({ entries, average: computeAverage(entries), email: req.session.email });
  } catch (err) {
    console.error('Failed to load entries from Drive:', err.message);
    res.status(502).json({ error: 'Could not load entries from Google Drive.' });
  }
});

app.post('/api/entries', requireAuth, async (req, res) => {
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

  try {
    const drive = driveClientForRequest(req);
    const fileId = await driveLib.ensureRemoteFile(drive, req.session.driveFileId);
    req.session.driveFileId = fileId;

    const entries = await driveLib.downloadEntries(drive, fileId);
    entries.push(entry);
    await driveLib.uploadEntries(drive, fileId, entries);

    res.status(201).json({ entries, average: computeAverage(entries) });
  } catch (err) {
    console.error('Failed to save entry to Drive:', err.message);
    res.status(502).json({ error: 'Saved failed: could not reach Google Drive.' });
  }
});

app.delete('/api/entries/:index', requireAuth, async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid entry index.' });
  }

  try {
    const drive = driveClientForRequest(req);
    const fileId = await driveLib.ensureRemoteFile(drive, req.session.driveFileId);
    req.session.driveFileId = fileId;

    const entries = await driveLib.downloadEntries(drive, fileId);
    if (index >= entries.length) {
      return res.status(404).json({ error: 'Entry not found.' });
    }
    entries.splice(index, 1);
    await driveLib.uploadEntries(drive, fileId, entries);

    res.json({ entries, average: computeAverage(entries) });
  } catch (err) {
    console.error('Failed to delete entry from Drive:', err.message);
    res.status(502).json({ error: 'Could not delete entry from Google Drive.' });
  }
});

app.listen(PORT, () => {
  console.log(`KilometersToLiter running at ${process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`}`);
  if (!driveLib.isEnvConfigured()) {
    console.warn(
      'Google OAuth env vars are not fully set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET). Sign-in will not work until they are.'
    );
  }
});
