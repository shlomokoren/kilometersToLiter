# Google Drive sync setup

This app stores its data locally in `data/db.json` and automatically syncs it
to `momoTools/KilometerstoLiter/db.json` in your Google Drive — pulling the
latest on startup and pushing after every new entry. Do this once per device.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/projectcreate and create a project
   (any name, e.g. "KilometersToLiter").
2. Go to **APIs & Services > Library**, search for **Google Drive API**, and
   click **Enable**.

## 2. Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External**, fill in an app name and your email, and save.
3. Under **Test users**, add your own Google account email.

## 3. Create OAuth credentials

1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Application type: **Desktop app**. Give it any name.
3. Click **Create**, then **Download JSON**.
4. Rename the downloaded file to `credentials.json` and put it in this
   project's root folder (next to `package.json`).

## 4. Authorize this device

Run:

```
npm run drive-auth
```

Your browser will open and ask you to log in and grant access. After you
approve, a `token.json` file is saved in the project root and the one-time
setup is done.

## 5. Run the app

```
npm start
```

On startup the app pulls the latest entries from Drive. Every time you add
an entry, it's saved locally and pushed to Drive immediately.

## Using it on a second device

Copy the whole project folder (including `credentials.json`) to the other
device, then run `npm install` and `npm run drive-auth` there too — each
device authorizes itself against the same Google account, and both will read
and write the same `momoTools/KilometerstoLiter/db.json` file.

`credentials.json` and `token.json` are gitignored since they're
account-specific — don't commit or share them.
