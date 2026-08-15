/**
 * admin.ts — the "safe" admin surface: user management + site content/config.
 *
 * Deliberately does NOT expose a code editor or a generic SQL/table editor.
 * See ARCHITECTURE.md "Admin panel: what it can and can't do" for the
 * reasoning. Every mutating action is written to audit_log.
 */
import { Router } from "express";
import { Users, SiteConfig, AuditLog, PageViews } from "../db";
import { requireAdmin, requireSuperAdmin } from "../auth/middleware";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

function publicUser(u: ReturnType<typeof Users.findById>) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
    role: u.role,
    isSuperAdmin: Boolean(u.is_super_admin),
    blocked: Boolean(u.blocked),
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    authMethod: u.google_id ? "google" : "password",
  };
}

adminRouter.get("/users", (_req, res) => {
  res.json({ users: Users.all().map(publicUser) });
});

adminRouter.post("/users/:id/block", (req, res) => {
  const id = Number(req.params.id);
  const target = Users.findById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.is_super_admin) return res.status(403).json({ error: "Cannot block the super-admin account" });
  if (target.id === req.currentUser!.id) return res.status(400).json({ error: "You cannot block yourself" });

  const blocked = Boolean(req.body?.blocked);
  Users.setBlocked(id, blocked);
  AuditLog.record(req.currentUser!.id, blocked ? "block_user" : "unblock_user", target.email);
  res.json({ user: publicUser(Users.findById(id)) });
});

// Only the super-admin can grant/revoke admin rights, so a compromised or
// careless regular admin can't create more admins or lock the owner out.
adminRouter.post("/users/:id/role", requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = Users.findById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.is_super_admin) return res.status(403).json({ error: "Cannot change the super-admin's role" });

  const role = req.body?.role;
  if (role !== "user" && role !== "admin") return res.status(400).json({ error: "role must be 'user' or 'admin'" });

  Users.setRole(id, role);
  AuditLog.record(req.currentUser!.id, `set_role:${role}`, target.email);
  res.json({ user: publicUser(Users.findById(id)) });
});

// --- Site config: the "safe" alternative to a code editor --------------
// Keys are free-form strings (e.g. "explain.meanVariance", "defaults.alpha")
// so the frontend's ExplanationPanel and default-parameter logic can pull
// editable copy/values without any of it being executable code.

adminRouter.get("/config", (_req, res) => {
  res.json({ config: SiteConfig.getAll() });
});

adminRouter.post("/config", (req, res) => {
  const { key, value } = req.body ?? {};
  if (typeof key !== "string" || typeof value !== "string") {
    return res.status(400).json({ error: "key and value (both strings) are required" });
  }
  if (key.length > 200 || value.length > 20000) {
    return res.status(400).json({ error: "key or value too long" });
  }
  SiteConfig.set(key, value, req.currentUser!.id);
  AuditLog.record(req.currentUser!.id, "set_config", key);
  res.json({ ok: true });
});

adminRouter.get("/audit-log", (_req, res) => {
  res.json({ entries: AuditLog.recent(300) });
});

// --- Visitors ------------------------------------------------------------

adminRouter.get("/visits/summary", (_req, res) => {
  res.json({ summary: PageViews.summary(), daily: PageViews.dailyCounts(30) });
});

adminRouter.get("/visits/recent", (_req, res) => {
  res.json({ visits: PageViews.recent(300) });
});
