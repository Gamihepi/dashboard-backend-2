import express from "express";
import { env } from "../config/env.js";

const router = express.Router();

function isAuthorized(req) {
  if (!env.cronSecret) {
    return true;
  }

  const headerSecret = String(req.headers["x-cron-secret"] || "").trim();
  const querySecret = String(req.query.key || "").trim();

  return headerSecret === env.cronSecret || querySecret === env.cronSecret;
}

router.get("/keep-alive", (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Invalid cron secret" });
  }

  res.set("Cache-Control", "no-store");

  return res.json({
    ok: true,
    job: "keep-alive",
    service: "addon-dashboard-backend",
    now: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

export default router;
