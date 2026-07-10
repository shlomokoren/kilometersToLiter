const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { google } = require('googleapis');

const ROOT = path.join(__dirname, '..');
const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`Missing credentials.json at ${CREDENTIALS_PATH}`);
    console.error('See SETUP.md for how to create one in Google Cloud Console.');
    process.exit(1);
  }

  const { installed, web } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const creds = installed || web;
  const oAuth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const authCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('Authorization failed. You can close this tab.');
        server.close();
        reject(new Error(`Google returned an error: ${error}`));
        return;
      }
      if (authCode) {
        res.end('Authorization complete! You can close this tab and return to the terminal.');
        server.close();
        resolve(authCode);
      }
    });
    server.listen(PORT, () => {
      console.log('Opening your browser to authorize Google Drive access...');
      console.log(`If it does not open automatically, visit:\n${authUrl}\n`);
      import('open').then(({ default: open }) => open(authUrl)).catch(() => {});
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`\nSaved credentials to ${TOKEN_PATH}`);
  console.log('You can now run "npm start".');
}

main().catch((err) => {
  console.error('Authorization failed:', err.message);
  process.exit(1);
});
