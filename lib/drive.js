const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT = path.join(__dirname, '..');
const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_PATH = ['momoTools', 'KilometerstoLiter'];
const FILE_NAME = 'db.json';

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing credentials.json at ${CREDENTIALS_PATH}. See SETUP.md for how to create a Google Cloud OAuth client and download it.`
    );
  }
  const { installed, web } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  return installed || web;
}

function getAuthClient() {
  const { client_id, client_secret, redirect_uris } = loadCredentials();
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris && redirect_uris[0]);

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      `Missing token.json at ${TOKEN_PATH}. Run "npm run drive-auth" once on this device to authorize Drive access.`
    );
  }
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oAuth2Client.setCredentials(token);

  oAuth2Client.on('tokens', (tokens) => {
    const merged = { ...token, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oAuth2Client;
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

async function ensureRemoteFile(drive) {
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

let clientPromise;
let fileIdPromise;

function getDrive() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(google.drive({ version: 'v3', auth: getAuthClient() }));
  }
  return clientPromise;
}

async function getFileId() {
  if (!fileIdPromise) {
    fileIdPromise = getDrive().then((drive) => ensureRemoteFile(drive));
  }
  return fileIdPromise;
}

async function pullEntries() {
  const drive = await getDrive();
  const fileId = await getFileId();
  return downloadEntries(drive, fileId);
}

async function pushEntries(entries) {
  const drive = await getDrive();
  const fileId = await getFileId();
  return uploadEntries(drive, fileId, entries);
}

function isConfigured() {
  return fs.existsSync(CREDENTIALS_PATH) && fs.existsSync(TOKEN_PATH);
}

module.exports = {
  isConfigured,
  pullEntries,
  pushEntries,
  CREDENTIALS_PATH,
  TOKEN_PATH,
  SCOPES,
};
