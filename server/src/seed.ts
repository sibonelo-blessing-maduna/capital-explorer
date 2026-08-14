/**
 * seed.ts — creates the super-admin account from environment variables.
 *
 * IMPORTANT: the admin password is never written into source code. It is
 * read once from ADMIN_SEED_PASSWORD (set in your .env locally, or in your
 * hosting provider's environment-variable dashboard in production), hashed
 * with bcrypt, and only the hash is stored in SQLite. Set ADMIN_SEED_PASSWORD
 * to a password you have NOT typed anywhere else — see DEPLOY.md.
 *
 * Safe to run repeatedly: does nothing if the super-admin row already
 * exists. Runs automatically on every server boot (see index.ts) and can
 * also be run standalone via `npm run seed`.
 */
import "dotenv/config";
import { Users } from "./db";
import { hashPassword } from "./auth/adminLocal";

export function ensureSuperAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.warn(
      "[seed] ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping super-admin seed. " +
        "The admin login page will have no account to authenticate until these are set and the server restarts."
    );
    return;
  }

  const existing = Users.findByEmail(email);
  if (existing) {
    if (!existing.is_super_admin) {
      console.warn(
        `[seed] A user with email ${email} already exists but is not marked super-admin. Not modifying it automatically.`
      );
    } else {
      console.log(`[seed] Super-admin ${email} already exists — nothing to do.`);
    }
    return;
  }

  Users.createAdmin(email, hashPassword(password), true);
  console.log(`[seed] Created super-admin account for ${email}.`);
}

if (require.main === module) {
  ensureSuperAdmin();
}
