# Deploying

This app is one Express process that, in production, also serves the built React client (see
`ARCHITECTURE.md` §3) plus a SQLite file it needs to persist across deploys. That combination
rules out purely serverless/stateless hosts (see `ARCHITECTURE.md` §7) but fits comfortably on any
host that gives you a small persistent disk. **Render, Fly.io, and Railway** are recommended for
exactly that reason. These instructions use Render as the walkthrough since it has the simplest
free tier for this shape of app; Fly.io and Railway differ mainly in dashboard layout, not in what
you need to configure.

## 1. Push this project to GitHub

```bash
cd capital-explorer
git init
git add .
git commit -m "Initial commit: capital partitioning explorer"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(If you already have an empty GitHub repo created, skip `git remote add` and use its URL instead.)
`.gitignore` already excludes `node_modules/`, build output, the local SQLite database, and any
`.env` file — double check `git status` before your first commit that nothing under `server/.env`
or `server/data/` is staged.

## 2. Set up Google OAuth (so "Continue with Google" works)

1. Go to the [Google Cloud Console credentials page](https://console.cloud.google.com/apis/credentials).
2. Create a project if you don't have one already (top-left project selector → "New Project").
3. Configure the OAuth consent screen (Console → "OAuth consent screen"): external user type is
   fine for a public tool; fill in an app name and support email. You don't need Google's
   verification review unless you plan on very high traffic.
4. Create credentials → OAuth client ID → Application type "Web application."
5. Under "Authorized redirect URIs," add:
   - `http://localhost:3001/api/auth/google/callback` (for local development)
   - `https://<your-deployed-domain>/api/auth/google/callback` (for production — add this once
     you know your Render URL, and again if you later attach a custom domain)
6. Save. Copy the generated **Client ID** and **Client Secret** — these become
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## 3. Deploy the server (Render)

1. [render.com](https://render.com) → New → Web Service → connect your GitHub repo.
2. **Root directory**: `server` (this repo has both `client/` and `server/` — Render needs to know
   which one is the actual service).
3. **Build command**: `npm install && npm run build` (compiles `server/src` to `server/dist`).

   The client also needs to be built into `client/dist` for the server to serve it in production
   (see `ARCHITECTURE.md` §3's static-serving step). The simplest way to get both built in one
   Render service is to change the build command to:
   ```
   npm install && npm run build && cd ../client && npm install && npm run build
   ```
4. **Start command**: `npm start` (runs `node dist/index.js`).
5. **Add a persistent disk**: Render → your service → "Disks" → add a disk, mount path
   `/opt/render/project/src/server/data` (or wherever your service's working directory resolves
   `server/data` to — check the "Shell" tab if unsure), at least 1GB. This is the step that makes
   your SQLite database survive redeploys; skipping it means every deploy starts from a blank
   database.
6. **Environment variables** (Render → your service → "Environment"): set every variable from
   `server/.env.example` except the commented-out ones you don't need:
   - `SESSION_SECRET` — generate with `openssl rand -base64 32` locally and paste the result.
   - `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` — your admin login. Choose a real password here,
     not the example placeholder.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from step 2.
   - `GOOGLE_REDIRECT_URI` — `https://<your-render-url>.onrender.com/api/auth/google/callback`
     (must exactly match what you entered in the Google Cloud Console).
   - `NODE_ENV=production` (Render sets this automatically on most plans, but set it explicitly if
     you're not sure).
   - Leave `COOKIE_SECURE` and `CLIENT_ORIGIN` unset — Render terminates HTTPS in front of your
     service and forwards `X-Forwarded-Proto`, and this app's `trust proxy` setting
     (`server/src/index.ts`) already trusts that, so secure cookies work correctly by default.
7. Deploy. Once it's live, revisit step 2 if you hadn't yet added the production redirect URI, and
   confirm "Continue with Google" actually completes a sign-in.

### If login "succeeds" but you're immediately signed out again

This is the one non-obvious failure mode worth calling out explicitly: if your admin login (or
Google login) returns success but a subsequent page load shows you as signed out, the session
cookie isn't reaching your browser — almost always because the app thinks the connection isn't
HTTPS even though it is (see `ARCHITECTURE.md`'s `COOKIE_SECURE` comment in `index.ts` for exactly
why express-session behaves this way). Check that your host is actually forwarding
`X-Forwarded-Proto: https` and that `trust proxy` is set (it is, by default, in this codebase). If
you're stuck, setting `COOKIE_SECURE=false` temporarily will confirm that's the issue (sessions
will start working, but now over an insecure cookie — don't leave it that way in production; fix
the proxy-trust configuration instead once confirmed).

## 4. Point your GitHub repo's README / project page at the live URL

Not required, but worth doing once you have a stable production URL — update the paper link and
any references to `localhost` in your own README with the real deployed address.

## 5. Ongoing: updating the deployed app

Push to `main` (or whatever branch your host watches) and most of these hosts auto-redeploy. The
SQLite database on the persistent disk survives redeploys as long as the disk stays attached — it
does not survive deleting and recreating the service from scratch, so treat "delete the service"
as "delete the database" and back up `server/data/app.db` first if you ever need to do that.

## Alternative: Azure App Service (what this repo's live instance actually uses)

The live deployment at the URL in `README.md` runs on Azure instead of Render, provisioned through
the Azure Portal's own GitHub integration rather than by hand. The steps below are what was
actually done, for reproducing this on a fresh Azure subscription (e.g. Azure for Students) or
understanding the existing setup.

### 1. Create the Web App through the Portal's Deployment Center

[portal.azure.com](https://portal.azure.com) → **App Services** → **+ Create** → **Web App**:

- **Runtime stack**: Node 22 LTS, **Linux**
- **App Service Plan**: **Basic B1** — the free F1 tier can't stay "always on" (it sleeps after 20
  minutes idle), which defeats the point of a permanently-running deployment.
- Once created, use the Web App's own **Deployment Center** (left sidebar) to connect it to this
  GitHub repo. Doing it this way — rather than a hand-written workflow with a downloaded publish
  profile — makes Azure create a **user-assigned managed identity with OIDC federation** to the
  repo and push a working GitHub Actions workflow plus the three secrets it needs
  (`AZUREAPPSERVICE_CLIENTID_...`, `_TENANTID_...`, `_SUBSCRIPTIONID_...`) automatically. No
  long-lived secret to copy or rotate.

### 2. Fix the generated workflow for this monorepo

The workflow Azure generates assumes a single-package app (`npm install && npm run build` at the
repo root). This repo has no root `package.json` — `client/` and `server/` are separate packages —
so that step needs replacing with one that builds each package and assembles the result into the
layout `server/src/index.ts` expects at runtime (`client/dist` two directories up from
`server/dist`). See [`.github/workflows/master_capital-explorer-sbm.yml`](./.github/workflows/master_capital-explorer-sbm.yml)
for the working version, which also gates the deploy on `client`'s `npm run verify` (the math
engine's regression tests) — a bad build never reaches production.

### 3. Configure the Web App itself

These are one-time settings, separate from the workflow, made in the Portal under the Web App's
**Settings → Configuration**:

- **General settings** tab:
  - **Startup Command**: `node server/dist/index.js` — without this, Oryx's auto-detection finds
    no entry point in a `client/` + `server/` layout and Azure silently serves its own placeholder
    "Welcome" page instead of your app (with a `200` on `/`, which makes the failure easy to miss —
    check `/api/health` instead of `/` when verifying a fresh deploy).
  - **Always On**: On (only available on B1+).
- **Application settings** tab — add every variable from `server/.env.example` except the
  commented-out ones, plus one Azure-specific addition:
  - `DB_DIR` = `/home/data` — **this is the one non-obvious setting.** Azure's zip-deploy replaces
    the entire `/home/site/wwwroot` folder (where the app's code lives) on every push. Render's
    model is a separate persistent disk mounted at a path you choose; Azure's is closer to "the
    whole app folder is disposable, `/home` outside it is not." Pointing `DB_DIR` at a path outside
    `wwwroot` (the app already supports this via `server/src/db.ts`'s `DB_DIR` env var) means the
    SQLite file survives every future deploy instead of being wiped.
  - Leave `COOKIE_SECURE` and `CLIENT_ORIGIN` unset, same reasoning as the Render section above.
- Optional: **Health check** tab → check the box, probe path `/api/health` (the same endpoint used
  above to verify a real deploy) — Azure will replace the instance if it stays unhealthy for an
  hour straight.

Saving Configuration changes restarts the app automatically.
