/**
 * index.ts — app entry point.
 *
 * Wires together: session middleware (SQLite-backed), user resolution,
 * the four route groups, and — in production — serves the built React
 * client as static files from the same process (so there's no CORS to
 * configure and only one service to deploy). See ARCHITECTURE.md
 * "Request lifecycle" for the full picture.
 */
import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "path";

import { SqliteSessionStore } from "./auth/session";
import { attachUser } from "./auth/middleware";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { settingsRouter } from "./routes/settings";
import { configRouter } from "./routes/config";
import { visitsRouter } from "./routes/visits";
import { ensureSuperAdmin } from "./seed";
import { ensureDefaultConfig } from "./defaultConfig";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN; // only needed in dev (Vite runs on a different port)

app.set("trust proxy", 1); // needed behind Render/Fly/Railway's proxy for secure cookies

// --- Minimal manual CORS for local dev (client on :5173, server on :3001).
// In production the client is served from this same origin, so this is a no-op.
if (!IS_PROD && CLIENT_ORIGIN) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

app.use(express.json({ limit: "1mb" }));

// A `secure` cookie is only ever sent by express-session over a connection
// it can see is HTTPS — with `trust proxy` set above, that means it trusts
// the `X-Forwarded-Proto` header from Render/Fly/Railway's proxy. If that
// header is ever missing or mistranslated on your specific host, the
// symptom is exactly "login returns 200 with a user object, but every
// following request is signed out" (no Set-Cookie is ever emitted — this
// is documented express-session behavior, not a bug in this app). Setting
// COOKIE_SECURE=false gives an explicit escape hatch for that case, or for
// exercising a production build locally over plain HTTP, without weakening
// the default (which is still "secure in production").
const COOKIE_SECURE = process.env.COOKIE_SECURE === "false" ? false : IS_PROD;

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me",
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(attachUser);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/config", configRouter);
app.use("/api/visits", visitsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

if (IS_PROD) {
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

ensureSuperAdmin();
ensureDefaultConfig();

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (${IS_PROD ? "production" : "development"})`);
  if (!process.env.SESSION_SECRET) {
    console.warn("[server] SESSION_SECRET is not set — using an insecure default. Set it before deploying.");
  }
});
