# Google sign-in setup

This app has no database of its own. Every visitor signs in with their own
Google account, and their entries live only in **their own** Drive, at
`momoTools/KilometerstoLiter/db.json`. The server never sees more than one
user's data at a time, and never stores it on disk.

You only need to do this once, no matter how many people will use the app —
it configures the *app itself* (one Google Cloud OAuth client shared by
everyone), not a per-person credential.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/projectcreate and create a project.
2. Go to **APIs & Services > Library**, search **Google Drive API**, click
   **Enable**.

## 2. Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External**, fill in an app name and your email, save.
3. Under **Test users**, add the email of everyone who should be able to sign
   in (yourself, family, etc.). While the app is in "Testing" status only
   these emails can sign in — that's fine for personal use and doesn't
   require Google's app-verification review. (If you later want *anyone* to
   be able to sign in, you'd need to publish the app and go through Google's
   verification, which isn't necessary here.)

## 3. Create an OAuth client

1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add both:
   - `http://localhost:3000/auth/google/callback` (local dev)
   - `https://<your-render-service>.onrender.com/auth/google/callback`
     (production — you'll get this URL in step 5, and can come back to add it)
4. Click **Create**. Copy the **Client ID** and **Client secret** shown.

## 4. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```
GOOGLE_CLIENT_ID=<from step 3>
GOOGLE_CLIENT_SECRET=<from step 3>
SESSION_SECRET=<any long random string>
BASE_URL=http://localhost:3000
```

`.env` is gitignored — it's never committed.

Then run locally:

```
npm install
npm start
```

Visit `localhost:3000`, click **Sign in with Google**, approve access. You're
in — entries you add are saved straight to your own Drive.

## 5. Deploy to Render

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Render: **New > Web Service**, connect the GitHub repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables in the Render dashboard (same names as `.env`):
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, and
   `BASE_URL` set to your Render URL (e.g. `https://kilometerstoliter.onrender.com`).
   Also set `NODE_ENV=production` so session cookies are marked secure.
5. Deploy. Once you have the live URL, go back to the OAuth client in Google
   Cloud Console (step 3) and make sure
   `https://<your-render-service>.onrender.com/auth/google/callback` is
   listed as an authorized redirect URI.

That's it — visit the Render URL from any device (including your phone),
sign in with Google, and you're using your own private data. Anyone else you
added as a test user can visit the same URL and sign in with their own
account to get their own independent, private fuel log.

## Notes on the security model

- The app only requests the `drive.file` scope — it can only see files it
  creates itself, never the rest of your Drive.
- Your Google access/refresh tokens are stored in a signed, httpOnly cookie
  in your own browser — not in any server-side database. The server itself
  holds nothing persistent between requests.
- `GOOGLE_CLIENT_SECRET` identifies the *app*, not any individual user, but
  unlike the old single-device setup this app used previously, a "Web
  application" OAuth client secret runs server-side and should be kept
  confidential — it's passed as an environment variable (never committed)
  both locally (`.env`, gitignored) and on Render (dashboard env var).
