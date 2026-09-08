import type { Request, Response, NextFunction } from "express";

/**
 * Minimal admin auth for the MVP: a shared API key in an `x-admin-api-key`
 * header, checked against ADMIN_API_KEY. This is intentionally simple -
 * production should replace it with Slack-workspace-scoped OAuth sessions
 * (an admin's identity comes from Slack, and their `role` on the User model
 * already exists for that) plus per-organization scoping so one company's
 * admin can never read or modify another company's challenge data.
 */
export function requireAdminApiKey(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-admin-api-key");
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY not set" });
    return;
  }
  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
