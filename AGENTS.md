# AGENTS — Repo guidance for AI coding agents

Purpose
- Short, actionable instructions to help AI agents be productive quickly.

Quick start (local)
- Install dependencies: `npm install`
- Run locally: `npm start` (starts at http://localhost:3000)
- See [SETUP.md](SETUP.md) for OAuth and deployment details.

Scripts
- `start`: runs `node server.js` (see `package.json`).

Key files
- [server.js](server.js) — Express server and API routes.
- [lib/drive.js](lib/drive.js) — Google OAuth (sign-in), used only for identity (email).
- [lib/db.js](lib/db.js) — Postgres connection, schema, and entry storage.
- [public/index.html](public/index.html) — frontend app shell.
- [public/app.js](public/app.js) — frontend logic.
- [SETUP.md](SETUP.md) — Google OAuth setup and deployment notes.
- [render.yaml](render.yaml) — Render.com deployment blueprint.
- [package.json](package.json) — project metadata and scripts.
- [.env.example](.env.example) — environment variables (do NOT commit secrets).

Project conventions & notes
- Storage: fuel entries are stored in a shared Postgres database (Neon), keyed by the signed-in user's email (see `lib/db.js`, `SETUP.md`).
- Auth: Google Sign-In is used only for identity/session (requests only the `userinfo.email` scope, no Drive access), via a single OAuth client configured via env vars; `.env` is gitignored.
- Security: never commit `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, or `.env`.

How agents should operate
- Link, don't embed: reference existing docs (e.g., [SETUP.md](SETUP.md)) rather than copying them.
- Minimal by default: only change files necessary to implement a requested feature or fix.
- Verify run commands: run `npm install` and `npm start` when testing runtime changes.
- Avoid secrets: if a task requires secrets, ask the user and never store them in the repo.

Where to look first
- Start with [server.js](server.js), [lib/db.js](lib/db.js), and [lib/drive.js](lib/drive.js) to understand backend flows.
- Frontend: review [public/app.js](public/app.js) and [public/index.html](public/index.html).

Next suggested customizations
- Add a `.github/copilot-instructions.md` if you want repo-specific IDE hints.
- Create a small `skills/` doc if you want automated agent tasks (e.g., run tests, linting).

Questions
- Do you want me to create `.github/copilot-instructions.md` with inline IDE hints, or keep using `AGENTS.md`?