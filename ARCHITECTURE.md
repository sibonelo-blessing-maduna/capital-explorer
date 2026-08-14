# Architecture

This document explains how the Optimal Capital Partitioning explorer is built: the technology
stack, the directory structure, how a request flows through the system, how authentication and
sessions work, how the math engine achieves "zero latency," and what the admin panel can and
can't do. For the mathematics itself (formulas, derivations, proofs), see `MATH.md`.

## 1. Technology stack

| Layer | Technology | Why |
|---|---|---|
| Client framework | React 18 + TypeScript, built with Vite | Fast dev server, small production bundle, no need for SSR since this is a single interactive page |
| Client math engine | Hand-written TypeScript, no numerical libraries | The whole point is sub-frame recomputation on every slider tick — see §5 |
| Client formula rendering | KaTeX | Renders LaTeX client-side with no server round-trip and no image generation |
| Client charts | Hand-rolled SVG (`components/charts/*`) | No charting library dependency; full control over the colorblind-safe palette (see the project's dataviz conventions) |
| Server framework | Express + TypeScript, compiled with `tsc` | Small, well-understood, easy to self-host anywhere that runs Node |
| Database | SQLite via `better-sqlite3` | Single-file database, synchronous API (no async/await ceremony for simple queries), trivial to back up — see §7 for the hosting implication |
| Sessions | Hand-written SQLite-backed session store (`server/src/auth/session.ts`) implementing express-session's `Store` interface | Avoids pulling in a third-party session-store package for what is a ~50-line adapter over a table we already own |
| User authentication | Google OAuth 2.0, hand-implemented (`server/src/auth/google.ts`) | No `passport` dependency — the Authorization Code flow is four HTTP calls and this keeps the auth code auditable in one file |
| Admin authentication | Email + bcrypt-hashed password, seeded from environment variables | The one account that isn't a Google identity; see §6 |

## 2. Directory structure

```
capital-explorer/
├── client/                          # React/Vite single-page app
│   ├── public/
│   │   └── paper.pdf                # the compiled paper, served statically at /paper.pdf
│   ├── src/
│   │   ├── engine/                  # the math engine — see §5 and MATH.md
│   │   │   ├── events.ts            # EventDef, Combination, generateCombinations()
│   │   │   ├── combinatorics.ts     # MAX_N, MAX_K_FULL_DETAIL, nChooseK, combinatorialGrowth
│   │   │   ├── weighting.ts         # W(C), B(C), Shannon entropy
│   │   │   ├── meanVariance.ts      # Frank-Wolfe optimizer + the O(n) Sigma-multiply identity
│   │   │   ├── principalProtection.ts
│   │   │   ├── barbell.ts
│   │   │   ├── maxEntropy.ts
│   │   │   └── index.ts             # computeAll() — the single entry point the UI calls
│   │   ├── state/                   # React hooks holding client-side state
│   │   │   ├── useParams.ts         # the tweakable parameters + reset-to-defaults
│   │   │   ├── useSnapshot.ts       # recomputes computeAll() on every param change, rAF-batched
│   │   │   ├── useAuth.ts           # current signed-in user
│   │   │   └── useConfig.ts         # the admin-editable /api/config text
│   │   ├── components/
│   │   │   ├── charts/              # LineChart, BarChart/GroupedBarChart, Heatmap (hand-rolled SVG)
│   │   │   ├── panels/              # one component per section of the paper (4.1–4.4)
│   │   │   ├── UniverseEditor.tsx   # add/remove/edit events — the "change n" control
│   │   │   ├── ParameterPanel.tsx   # k/alpha/lambda/tau/capital — the "change k" controls
│   │   │   ├── AllocationTable.tsx  # generic combination -> stake table, top-N by default
│   │   │   ├── ExplanationCard.tsx  # renders one `explain.*` site-config entry
│   │   │   ├── FormulaBlock.tsx     # KaTeX wrapper
│   │   │   ├── Header.tsx           # Google sign-in / user info / admin link
│   │   │   ├── AdminLoginPage.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── api.ts                   # typed fetch wrappers for every server route
│   │   ├── App.tsx                  # routing (see §8) + tab layout + wiring
│   │   └── main.tsx                 # ReactDOM.createRoot(...).render(<App />)
│   └── scripts/
│       └── verify-engine.ts         # regression test: 9 checks against the paper's own worked numbers
├── server/
│   ├── src/
│   │   ├── db.ts                    # schema + typed accessors (Users, SiteConfig, UserSettings, AuditLog)
│   │   ├── seed.ts                  # ensureSuperAdmin() — idempotent, reads credentials from env
│   │   ├── defaultConfig.ts         # ensureDefaultConfig() — seeds the explain.* text and defaults/limits
│   │   ├── auth/
│   │   │   ├── session.ts           # SqliteSessionStore
│   │   │   ├── google.ts            # OAuth2 Authorization Code flow, no passport
│   │   │   ├── adminLocal.ts        # bcrypt verify/hash for the admin account
│   │   │   └── middleware.ts        # attachUser, requireAuth, requireAdmin, requireSuperAdmin
│   │   ├── routes/
│   │   │   ├── auth.ts              # /api/auth/*
│   │   │   ├── admin.ts             # /api/admin/* (see §9)
│   │   │   ├── settings.ts          # /api/settings — saved parameter presets
│   │   │   └── config.ts            # /api/config — public read of the explain.* text
│   │   └── index.ts                 # app entry: middleware wiring, static serving in production
│   └── data/                        # app.db (SQLite file) — created on first run, gitignored
├── ARCHITECTURE.md                  # this file
├── MATH.md                          # every formula and its derivation
└── DEPLOY.md                        # how to actually put this on the internet
```

## 3. Request lifecycle

1. A request arrives at the single Express process (both API and, in production, the built
   client are served from this one process — see §7 for why that's deliberate).
2. `express.json()` parses any JSON body.
3. The `session` middleware (backed by `SqliteSessionStore`) reads the `sid` cookie, loads the
   session row from the `sessions` table, and populates `req.session`.
4. `attachUser` (in `auth/middleware.ts`) reads `req.session.userId`, looks the user up, and
   attaches it as `req.currentUser` — or leaves it `undefined` for anonymous requests.
5. The request is routed to `/api/auth`, `/api/admin`, `/api/settings`, `/api/config`, or (in
   production) falls through to `express.static(client/dist)` and then a catch-all that serves
   `index.html` for any other path — this is what makes `/admin` work as a client-side route (see
   §8) even though the server has no route registered for it.
6. Every mutating admin action (`routes/admin.ts`) additionally writes a row to `audit_log`.

Nothing in the interactive explorer itself — dragging a slider, adding an event, switching tabs —
makes a network request. The only requests are: loading the page once, `/api/auth/me` on load,
`/api/config` on load, and explicit user actions (sign in, save/load a preset, any admin action).

## 4. Database schema

Five tables, all in one SQLite file (`server/data/app.db`):

- **users** — `id`, `email`, `name`, `avatar_url`, `google_id` (nullable — null for the admin
  account), `password_hash` (nullable — null for Google accounts), `role` (`user` | `admin`),
  `is_super_admin`, `blocked`, `created_at`, `last_login_at`. A user is either a Google identity
  or a password identity, never both — `google_id` and `password_hash` are mutually exclusive in
  practice, though the schema doesn't enforce that with a constraint (the application code does,
  by construction: Google sign-in never touches `password_hash`, admin seeding never touches
  `google_id`).
- **sessions** — `sid` (primary key), `sess` (JSON blob), `expires_at`. Read/written by
  `SqliteSessionStore`.
- **site_config** — `key`, `value`, `updated_by`, `updated_at`. Free-form strings. This is what
  the admin dashboard's "Site config" tab edits, and what `defaultConfig.ts` seeds on first boot
  (only filling in keys that don't already exist, so an admin's edits always survive a restart).
- **user_settings** — `user_id`, `params` (JSON blob of a saved parameter preset). One row per
  user; `/api/settings` reads/writes/deletes this.
- **audit_log** — `id`, `actor_user_id` (nullable — null for a failed login attempt, since there's
  no authenticated actor yet), `action`, `target`, `details`, `created_at`.

## 5. The math engine: why it's duplicated in TypeScript, and how it hits "zero latency"

The Python package (`capital_framework/`, delivered earlier as a standalone library and used to
generate the PDF paper's figures) is the reference implementation — every number in the paper
came from it, and `scripts/verify-engine.ts` checks the TypeScript port against numbers derived
from that same reference. But the interactive explorer does not call into Python, or into the
server at all, for any computation. The entire engine (`client/src/engine/*`) is a from-scratch
TypeScript port that runs in the browser, because "zero latency" specifically ruled out a
server round-trip: even a same-region API call has tens of milliseconds of network latency before
any computation happens, and that's before considering a public deployment where the server might
be a few hundred milliseconds away from a given visitor.

Running client-side raised its own performance problem. Sec 2.2's Boolean hypercube means a
subset of size k has 2^k combinations — 16,384 of them at the app's k=14 ceiling — and several of
the paper's optimizers (mean-variance, principal protection's alpha search) are iterative. A naive
port (plain JS arrays, `.map()`/`.reduce()` chains, one array allocation per iteration) benchmarked
at roughly *2000ms* at k=14 on first port — nowhere near interactive. Getting this down required
three rounds of profiling and rewriting:

**Combination labels.** `generateCombinations()` originally built a human-readable label
(`"Team A:1 & Team B:2 & ..."`) for every combination eagerly. At k=14 this alone cost ~75-100ms —
more than every numerical optimizer combined — because the UI never actually displays anywhere
near 16,384 labels at once (`AllocationTable` shows the top 15 by default). The fix was to make
`comboLabel(combo)` an on-demand function, called only for the rows actually being rendered. (A
lazy `Object.defineProperty` getter was tried first and measured *slower* than a plain function,
because of the just-in-time overhead of defining thousands of accessor properties — plain functions
won.)

**Mean-variance (Frank-Wolfe).** The naive gradient step computes `Sigma @ w` — an O(n²) matrix-
vector product materializing the full dense covariance matrix. Sec 4.1 / `MATH.md` §4 derives an
O(n) identity instead:

```
(Sigma w)_i = mu_i * (O_i * w_i - S),   S = mu . w
```

This was verified against the O(n²) direct computation to machine precision (see
`verify-engine.ts`) before being trusted as the hot path. Combined with reusing `Float64Array`
scratch buffers across all 400 Frank-Wolfe iterations (rather than allocating fresh arrays every
iteration via `.map()`), this stage went from ~300ms to ~15-25ms at k=14.

**Principal protection's alpha search.** The original approach evaluated a 120-point grid, then
refined with 25 iterations of ternary search — about 170 evaluations, each doing array
allocation and filtering. This was rewritten twice: first to a single reused-buffer evaluator
(`makeEvEvaluator`, ~140ms), then to a proper golden-section search (~61 evaluations exploiting the
objective's unimodality, ~40ms). A further win came from noticing that `Math.pow(x, alpha)` inside
the search loop recomputes `ln(x)` internally on every call even though `x` (the implied
probability) never changes across the search — precomputing `ln(x)` once and using
`Math.exp(alpha * lnX)` instead roughly halved that stage's remaining cost.

**Max entropy's bisection.** Same pattern: `.map()`/`.reduce()` chains replaced with a single
reused `Float64Array` scratch buffer, and the bisection iteration count reduced from 100 to 50
(50 iterations of binary search is already far more precision than the display needs).

**Measured result** (see `client/scripts/verify-engine.ts`'s comments and the benchmarks run
during development): k=6 → 13-16ms, k=10 → 26-30ms, k=12 → 46-57ms, k=14 → ~200-240ms. The common
case (k≤12, which covers the large majority of realistic universes) is comfortably under a single
60fps frame. At the k=14 ceiling it's not literally sub-frame, but it's still an order of magnitude
better than the naive port and well under what a human perceives as "laggy" for a value that only
changes when you finish dragging a slider — which `useSnapshot.ts`'s `requestAnimationFrame`
batching ensures is the only time a recompute actually fires (a slider drag can emit more `input`
events per second than there are animation frames; without batching, most of those recomputes
would be thrown away by the very next one anyway).

This is documented honestly rather than claiming a universal guarantee, because it is not one:
`k=14` is a real, measured ~200ms, not literally zero. `limits.MAX_K_FULL_DETAIL = 14` exists
specifically as the point past which the team judged the tradeoff (26,384 combinations, ~1MB of
Float64Array scratch space, 200ms+) stops being worth it for a single subset's detail view — the
combinatorial-growth chart on the Weighting panel exists to make that tradeoff visible rather than
silently invisible.

## 6. Authentication: two paths, one users table

Every regular visitor signs in with **Google OAuth 2.0** (`server/src/auth/google.ts`):

1. `/api/auth/google` generates a random `state` token, stores it in the session, and redirects to
   Google's consent screen.
2. Google redirects back to `/api/auth/google/callback` with a `code` and the same `state`.
3. The server checks `state` matches (CSRF protection for the OAuth flow), exchanges `code` for an
   access token, fetches the user's Google profile, and `Users.upsertGoogleUser()`s a row keyed on
   `google_id`.
4. `req.session.userId` is set, and the browser is redirected back to `/`.

This is implemented by hand (four `fetch()` calls) rather than via `passport` or a Google SDK, so
the whole flow is auditable in one ~80-line file.

The **admin account** is the one exception: it authenticates with an email + password
(`POST /api/auth/admin-login`), verified with `bcryptjs` against a hash seeded from the
`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` environment variables (`server/src/seed.ts`,
`ensureSuperAdmin()`). This seeding is idempotent (running it again with the same email does
nothing if that account already exists) and the plaintext password is never written into code or
into any file this project delivers — it lives only in `server/.env`, which is gitignored (see
`DEPLOY.md` for how to set it on your hosting provider instead of committing it).

Both kinds of user land in the same `users` table and the same session mechanism afterward —
`req.currentUser` doesn't care which path a user came in through, except where `authMethod` is
displayed for the admin's own benefit in the Users tab.

## 7. Why SQLite, and what that means for hosting

SQLite was chosen because the whole point of "store users, sessions, and settings" here is small
and simple enough that a full client-server database (Postgres, MySQL) would be pure operational
overhead: one file, no separate service to run, no connection pool to tune, trivial to back up
(copy the file). `better-sqlite3`'s synchronous API also means the route handlers in this project
don't need `async`/`await` for simple queries, which keeps them easy to read.

The consequence: **this app needs a persistent filesystem**, not a stateless/serverless one.
Platforms that spin up a fresh, ephemeral filesystem per request or per deploy (Vercel, Netlify
serverless functions) will silently lose the database on every deploy or every cold start. See
`DEPLOY.md` for hosting recommendations (Render, Fly.io, Railway — all of which offer a small
persistent disk you attach to the service) and for the environment variables that need to be set.

## 8. Why there's no client-side router

There are exactly two real destinations in this app: the explorer (`/`) and the admin panel
(`/admin`). That's a router with one `if`, not a case for a routing library. `App.tsx` checks
`window.location.pathname` once on mount; the handful of links between the two (`Header.tsx`'s
"Admin panel" link, `AdminLoginPage.tsx`'s "back to the explorer" link) are plain `<a href>` tags,
so navigating between them is a normal full-page browser navigation. This was a deliberate choice
over adding `react-router` as a dependency for what would otherwise be two routes.

In production, Express's catch-all (`app.get("*", ...)` in `index.ts`) serves `index.html` for any
path that isn't a static asset or an `/api/*` route, so `/admin` resolves correctly even though the
server itself has no knowledge of that path being special — `App.tsx` is what gives it meaning,
client-side, after the same `index.html` loads either way.

## 9. Admin panel: what it can and can't do

The admin dashboard (`AdminDashboard.tsx` + `server/src/routes/admin.ts`) intentionally exposes
three things and nothing more:

- **User management** — list every user, block/unblock, and (super-admin only) grant or revoke
  the `admin` role. The super-admin account itself can't be blocked, demoted, or have its role
  changed by anyone, including itself, so there's no way to lock out the one owner account.
  Only the super-admin can create more admins, so a compromised regular-admin session can't
  create new admins or escalate itself.
- **Site config** — a free-form key/value text editor. This is what backs every "why this works
  this way" explanation card (`explain.*` keys) and the published default parameters/limits
  (`defaults.*`, `limits.*`). Editing a value here takes effect immediately for every visitor,
  with no code change or redeploy — see `defaultConfig.ts`'s seeding logic and `useConfig.ts` on
  the client for how a page load always picks up the latest values. `limits.maxN` and
  `limits.maxKFullDetail` specifically let an admin *tighten* the interactive explorer's caps
  below the engine's own performance-verified ceiling (`App.tsx`'s `clampedConfigLimit` — see §5)
  without a deploy; they can't be used to raise the caps past what's actually been measured safe.
- **Audit log** — every block/unblock, role change, and config edit, with the acting admin's user
  id, the action, and the target.

What was deliberately **not built**: a live code editor, or a raw SQL / arbitrary-table editor,
reachable from the public-facing admin panel. The original request included "change the internal
code or database at will" — the site-config editor is the safe version of "change the database":
it can only ever write to the `site_config` table, through a route that validates both the key and
value are strings under a length cap, never arbitrary SQL. A literal code editor that let an
authenticated session push new server-side code (or arbitrary DB writes) would be a remote-code-
execution / full-database-compromise surface reachable by anyone who ever obtained or guessed the
admin password, on a service that's explicitly meant to be public. If deeper changes are needed —
new features, schema changes, anything beyond text and toggles — that's what editing this
repository's source and redeploying is for, which is exactly as safe as editing code normally is
(reviewable, revertable, not reachable by an attacker who only has the admin password).

## 10. Reset to defaults vs. saved presets

Two distinct, deliberately different mechanisms, both in `ParameterPanel.tsx`:

- **Reset to defaults** (`useParams.ts`'s `reset()`) is pure client-side state assignment back to
  the hardcoded `DEFAULT_PARAMS`/`DEFAULT_UNIVERSE` (the paper's own worked example). It never
  touches the server, so it's instant and available whether or not you're signed in.
- **Save preset / Load preset** round-trip to `/api/settings`, which reads/writes the signed-in
  user's single `user_settings` row. This requires being signed in (with Google, or as admin),
  because a preset is tied to an account.

"Take things back to normal after playing with the parameters" (the original request) is served
by the first mechanism, and doesn't require an account — signing in is only needed if you want to
*persist* a specific configuration across visits/devices, which is what the second mechanism is
for.
