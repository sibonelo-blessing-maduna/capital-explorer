/**
 * db.ts — SQLite schema + typed accessors.
 *
 * Single file owns the schema (idempotent CREATE TABLE IF NOT EXISTS) and a
 * small set of typed helper functions. better-sqlite3 is synchronous, which
 * keeps every call site simple (no await needed) and is more than fast
 * enough for this app's traffic profile — the perf-sensitive work (the math
 * engine) all happens client-side, per ARCHITECTURE.md.
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DB_DIR || path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id      TEXT UNIQUE,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT,
  avatar_url     TEXT,
  role           TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  password_hash  TEXT,
  blocked        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  sess       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id    INTEGER PRIMARY KEY,
  params_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  action        TEXT NOT NULL,
  target        TEXT,
  details       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
`);

export interface UserRow {
  id: number;
  google_id: string | null;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  is_super_admin: number;
  password_hash: string | null;
  blocked: number;
  created_at: string;
  last_login_at: string | null;
}

export const Users = {
  findByGoogleId(googleId: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId) as UserRow | undefined;
  },
  findByEmail(email: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
  },
  findById(id: number): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  },
  all(): UserRow[] {
    return db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[];
  },
  upsertGoogleUser(input: { googleId: string; email: string; name?: string; avatarUrl?: string }): UserRow {
    const existing = this.findByGoogleId(input.googleId) ?? this.findByEmail(input.email);
    if (existing) {
      db.prepare(
        `UPDATE users SET google_id = ?, name = ?, avatar_url = ?, last_login_at = datetime('now') WHERE id = ?`
      ).run(input.googleId, input.name ?? existing.name, input.avatarUrl ?? existing.avatar_url, existing.id);
      return this.findById(existing.id)!;
    }
    const info = db
      .prepare(
        `INSERT INTO users (google_id, email, name, avatar_url, role, last_login_at)
         VALUES (?, ?, ?, ?, 'user', datetime('now'))`
      )
      .run(input.googleId, input.email.toLowerCase(), input.name ?? null, input.avatarUrl ?? null);
    return this.findById(info.lastInsertRowid as number)!;
  },
  createAdmin(email: string, passwordHash: string, isSuperAdmin: boolean): UserRow {
    const info = db
      .prepare(
        `INSERT INTO users (email, name, role, is_super_admin, password_hash)
         VALUES (?, 'Admin', 'admin', ?, ?)`
      )
      .run(email.toLowerCase(), isSuperAdmin ? 1 : 0, passwordHash);
    return this.findById(info.lastInsertRowid as number)!;
  },
  setBlocked(id: number, blocked: boolean) {
    db.prepare("UPDATE users SET blocked = ? WHERE id = ?").run(blocked ? 1 : 0, id);
  },
  setRole(id: number, role: "user" | "admin") {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  },
  touchLogin(id: number) {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  },
};

export const SiteConfig = {
  get(key: string): string | undefined {
    const row = db.prepare("SELECT value FROM site_config WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value;
  },
  getAll(): Record<string, string> {
    const rows = db.prepare("SELECT key, value FROM site_config").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  set(key: string, value: string, updatedBy: number | null) {
    db.prepare(
      `INSERT INTO site_config (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`
    ).run(key, value, updatedBy);
  },
};

export const UserSettings = {
  get(userId: number): string | undefined {
    const row = db.prepare("SELECT params_json FROM user_settings WHERE user_id = ?").get(userId) as
      | { params_json: string }
      | undefined;
    return row?.params_json;
  },
  set(userId: number, paramsJson: string) {
    db.prepare(
      `INSERT INTO user_settings (user_id, params_json, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET params_json = excluded.params_json, updated_at = datetime('now')`
    ).run(userId, paramsJson);
  },
  clear(userId: number) {
    db.prepare("DELETE FROM user_settings WHERE user_id = ?").run(userId);
  },
};

export const AuditLog = {
  record(actorUserId: number | null, action: string, target?: string, details?: unknown) {
    db.prepare(
      `INSERT INTO audit_log (actor_user_id, action, target, details) VALUES (?, ?, ?, ?)`
    ).run(actorUserId, action, target ?? null, details ? JSON.stringify(details) : null);
  },
  recent(limit = 200) {
    return db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?").all(limit);
  },
};
