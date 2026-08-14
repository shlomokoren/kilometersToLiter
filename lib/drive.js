const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/userinfo.email'];

function isEnvConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET);
}

function baseUrl() {
  // RENDER_EXTERNAL_URL is injected automatically by Render — no manual BASE_URL needed there.
  // On Vercel, VERCEL_URL is per-deployment and won't match a registered OAuth redirect URI,
  // so set BASE_URL explicitly in the Vercel project's env vars to your stable production domain.
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
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

module.exports = {
  isEnvConfigured,
  createOAuthClient,
  getAuthUrl,
  exchangeCode,
  getEmail,
  SCOPES,
};
