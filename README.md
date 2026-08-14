# Optimal Capital Partitioning — Interactive Explorer

An interactive, in-browser companion to the paper *"Optimal Capital Partitioning Across
Binary-Outcome Combinatorial Subsets"* by Sibonelo Blessing Maduna. Every panel recomputes live as
you tweak the event universe, subset size k, weighting exponent alpha, risk-aversion lambda, or
target return tau — entirely client-side, with no server round-trip on any slider change.

- **The paper**: `/paper.pdf` once running, or `client/public/paper.pdf` in this repo.
- **How it's built, file by file**: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Every formula and its derivation**: [`MATH.md`](./MATH.md).
- **Putting this on the internet**: [`DEPLOY.md`](./DEPLOY.md).

## What's in this repository

```
capital-explorer/
├── client/     React + TypeScript + Vite single-page app (the math engine + UI)
├── server/     Express + TypeScript API (auth, sessions, admin, site config) + SQLite
├── ARCHITECTURE.md
├── MATH.md
└── DEPLOY.md
```

## Running it locally

Requires Node.js 18+.

```bash
# 1. Server
cd server
npm install
cp .env.example .env      # then edit .env — see comments inline for what each value means
npm run dev                # starts the API on http://localhost:3001

# 2. Client (separate terminal)
cd client
npm install
npm run dev                # starts Vite on http://localhost:5173, proxying API calls to :3001
```

Open `http://localhost:5173`. "Continue with Google" will show as disabled until you set
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` in `server/.env` — see
`DEPLOY.md`'s "Setting up Google OAuth" section, which applies to local development too (use
`http://localhost:3001/api/auth/google/callback` as the redirect URI). The admin login at
`http://localhost:5173/admin` works immediately using whatever `ADMIN_SEED_EMAIL` /
`ADMIN_SEED_PASSWORD` you set in `.env`.

### Running the math-engine regression tests

```bash
cd client
npm run verify
```

This checks the TypeScript engine's output against known reference numbers (the alpha=1 hedge, the
mean-variance/hedge convergence at high lambda, the barbell closed-form ratio against `scipy`'s
numerical answer, and more) — see `MATH.md`'s "Cross-checks" section for what each check verifies
and why.

### Building for production

```bash
cd server && npm run build   # compiles server/src -> server/dist
cd client && npm run build   # compiles + bundles client/src -> client/dist
cd server && NODE_ENV=production npm start   # serves the API and the built client together
```

See `DEPLOY.md` for deploying this to Render, Fly.io, or Railway, including the persistent-disk
setup SQLite needs and the full Google OAuth Console walkthrough.

## What each part of the original request maps to

- **"View the paper in an interactive way"** — the four strategy panels (Weighting, Mean-Variance,
  Principal Protection, Barbell, Max Entropy) plus the "why this works this way" explanation card
  on each, and a link to the full PDF.
- **"Panels they can tweak parameters with... zero latency"** — `client/src/engine/*`; see
  `ARCHITECTURE.md` §5 for the performance work behind that claim and its honest limits.
- **"SQLite database which stores users, sessions, and stuff"** — `server/src/db.ts`; see
  `ARCHITECTURE.md` §4.
- **"Take things back to normal after playing with the parameters"** — the "Reset to defaults"
  button; see `ARCHITECTURE.md` §10.
- **"Log in should be continuing with Google"** — `server/src/auth/google.ts`; see
  `ARCHITECTURE.md` §6.
- **"Log in as admin... make any account admin or block them or change the internal code or
  database at will"** — the admin dashboard at `/admin`; see `ARCHITECTURE.md` §9 for exactly what
  it can do and the deliberate limits on what it can't (no live code editor, no raw-SQL editor —
  reasoning explained there).
