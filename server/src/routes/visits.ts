/**
 * visits.ts — records one row per real page load, for the admin dashboard's
 * "Visitors" tab. The client fires this once on mount (see App.tsx); there is
 * no client-side router in this app (see App.tsx's top comment), so one call
 * per mount is exactly one real navigation, not a double-count.
 */
import crypto from "crypto";
import { Router } from "express";
import { PageViews } from "../db";

export const visitsRouter = Router();

const VISITOR_COOKIE = "vid";
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

function readCookie(req: import("express").Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getOrSetVisitorId(req: import("express").Request, res: import("express").Response): string {
  const existing = readCookie(req, VISITOR_COOKIE);
  if (existing) return existing;
  const vid = crypto.randomUUID();
  res.cookie(VISITOR_COOKIE, vid, { maxAge: VISITOR_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" });
  return vid;
}

visitsRouter.post("/", (req, res) => {
  const { path } = req.body ?? {};
  if (typeof path !== "string" || path.length > 500) {
    return res.status(400).json({ error: "path is required" });
  }
  const referrer = typeof req.body?.referrer === "string" ? req.body.referrer.slice(0, 500) : null;

  const visitorId = getOrSetVisitorId(req, res);
  PageViews.record({
    visitorId,
    userId: req.currentUser?.id ?? null,
    path,
    referrer,
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
  });
  res.json({ ok: true });
});
