/**
 * session.ts — a minimal SQLite-backed express-session store.
 *
 * Written by hand (rather than pulling in connect-sqlite3) so the whole
 * session lifecycle lives in one file next to db.ts and uses the same
 * better-sqlite3 connection style (synchronous) as the rest of the app.
 * See ARCHITECTURE.md "Sessions" for the full read/write lifecycle.
 */
import { Store } from "express-session";
import { db } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

export class SqliteSessionStore extends Store {
  constructor(private ttlMs: number = 7 * DAY_MS) {
    super();
    // Opportunistic cleanup of expired rows on boot.
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  }

  get(sid: string, callback: (err: unknown, session?: any) => void): void {
    try {
      const row = db.prepare("SELECT sess, expires_at FROM sessions WHERE sid = ?").get(sid) as
        | { sess: string; expires_at: number }
        | undefined;
      if (!row || row.expires_at < Date.now()) return callback(null, null as any);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, session: any, callback?: (err?: unknown) => void): void {
    try {
      const expiresAt = Date.now() + this.ttlMs;
      db.prepare(
        `INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`
      ).run(sid, JSON.stringify(session), expiresAt);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, session: any, callback?: (err?: unknown) => void): void {
    try {
      const expiresAt = Date.now() + this.ttlMs;
      db.prepare("UPDATE sessions SET expires_at = ? WHERE sid = ?").run(expiresAt, sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}
