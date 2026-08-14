/**
 * config.ts — public read-only access to site_config.
 *
 * Everything in site_config is meant to be displayed (explanatory text,
 * default parameter presets/ranges) so there is nothing sensitive to
 * protect here; writes are admin-only (see routes/admin.ts).
 */
import { Router } from "express";
import { SiteConfig } from "../db";

export const configRouter = Router();

configRouter.get("/", (_req, res) => {
  res.json({ config: SiteConfig.getAll() });
});
