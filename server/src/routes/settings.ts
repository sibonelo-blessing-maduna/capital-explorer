/**
 * settings.ts — per-user saved parameter presets ("remember where I left off").
 *
 * This is distinct from the in-page "Reset to defaults" button, which is
 * pure client-side state and touches the server not at all (see
 * ARCHITECTURE.md "Reset to defaults vs. saved presets"). This route is
 * for a signed-in user who wants their tweaked (n, k, alpha, lambda, tau,
 * universe) configuration to survive a page reload / a new visit.
 */
import { Router } from "express";
import { UserSettings, AuditLog } from "../db";
import { requireAuth } from "../auth/middleware";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", (req, res) => {
  const raw = UserSettings.get(req.currentUser!.id);
  res.json({ params: raw ? JSON.parse(raw) : null });
});

settingsRouter.post("/", (req, res) => {
  const params = req.body?.params;
  if (!params || typeof params !== "object") {
    return res.status(400).json({ error: "params object is required" });
  }
  const json = JSON.stringify(params);
  if (json.length > 50000) return res.status(400).json({ error: "params payload too large" });
  UserSettings.set(req.currentUser!.id, json);
  res.json({ ok: true });
});

settingsRouter.delete("/", (req, res) => {
  UserSettings.clear(req.currentUser!.id);
  AuditLog.record(req.currentUser!.id, "clear_saved_settings");
  res.json({ ok: true });
});
