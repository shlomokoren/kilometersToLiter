const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_PATH = ['momoTools', 'KilometerstoLiter'];
const FILE_NAME = 'db.json';

function isEnvConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET);
}

function baseUrl() {
  // RENDER_EXTERNAL_URL is injected automatically by Render — no manual BASE_URL needed there.
  return process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl()}/auth/google/callback`
  );
}

function getAuthUrl(oauth2Client, state) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

async function exchangeCode(oauth2Client, code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getEmail(oauth2Client) {
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}

function driveFor(tokens, onTokenRefresh) {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);
  if (onTokenRefresh) {
    oauth2Client.on('tokens', (refreshed) => {
      onTokenRefresh({ ...tokens, ...refreshed });
    });
  }
  return { drive: google.drive({ version: 'v3', auth: oauth2Client }), oauth2Client };
}

async function findChild(drive, name, parentId, mimeType) {
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
  const mimeClause = mimeType ? ` and mimeType = '${mimeType}'` : '';
  const res = await drive.files.list({
    q: `name = '${name}' and trashed = false and ${parentClause}${mimeClause}`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files && res.data.files[0];
}

async function ensureFolder(drive, name, parentId) {
  const existing = await findChild(drive, name, parentId, FOLDER_MIME);
  if (existing) return existing.id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });
  return created.data.id;
}

async function ensureRemoteFile(drive, knownFileId) {
  if (knownFileId) return knownFileId;

  let parentId;
  for (const folder of FOLDER_PATH) {
    parentId = await ensureFolder(drive, folder, parentId);
  }
  const existing = await findChild(drive, FILE_NAME, parentId);
  if (existing) return existing.id;

  const created = await drive.files.create({
    requestBody: { name: FILE_NAME, parents: [parentId] },
    media: { mimeType: 'application/json', body: '[]' },
    fields: 'id',
  });
  return created.data.id;
}

async function downloadEntries(drive, fileId) {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
  const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  return raw.trim() ? JSON.parse(raw) : [];
}

async function uploadEntries(drive, fileId, entries) {
  await drive.files.update({
    fileId,
    media: { mimeType: 'application/json', body: JSON.stringify(entries, null, 2) },
  });
}

module.exports = {
  isEnvConfigured,
  createOAuthClient,
  getAuthUrl,
  exchangeCode,
  getEmail,
  driveFor,
  ensureRemoteFile,
  downloadEntries,
  uploadEntries,
  SCOPES,
};
