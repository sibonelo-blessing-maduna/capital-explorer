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
