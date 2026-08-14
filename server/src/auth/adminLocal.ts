/**
 * adminLocal.ts — email/password verification for the admin login page.
 *
 * This is intentionally separate from the Google flow: only rows in `users`
 * that have a non-null password_hash can use it, and in practice that's
 * just the super-admin seeded by seed.ts (see below) plus anyone the
 * super-admin later grants a password to via the admin API, if ever
 * needed. Ordinary users authenticate exclusively via Google.
 */
import bcrypt from "bcryptjs";
import { Users } from "../db";

export function verifyAdminLogin(email: string, password: string) {
  const user = Users.findByEmail(email);
  if (!user || !user.password_hash) return null;
  if (user.role !== "admin") return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  return ok ? user : null;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}
