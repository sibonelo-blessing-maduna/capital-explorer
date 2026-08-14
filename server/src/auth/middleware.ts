/**
 * middleware.ts — session → user resolution, and role/block gates.
 *
 * Every request that reaches a route handler already has `req.currentUser`
 * populated (or null) by `attachUser`, which runs on every request. The
 * three guard middlewares below then gate specific routes.
 */
import type { NextFunction, Request, Response } from "express";
import { Users, type UserRow } from "../db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    oauthState?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: UserRow | null;
    }
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session.userId;
  req.currentUser = userId ? Users.findById(userId) ?? null : null;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ error: "Not signed in" });
  if (req.currentUser.blocked) return res.status(403).json({ error: "This account has been blocked" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ error: "Not signed in" });
  if (req.currentUser.blocked) return res.status(403).json({ error: "This account has been blocked" });
  if (req.currentUser.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ error: "Not signed in" });
  if (!req.currentUser.is_super_admin) return res.status(403).json({ error: "Super-admin access required" });
  next();
}
