import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import modsRoutes from "./routes/mods.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import cronRoutes from "./routes/cron.routes.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import searchkeywordRoutes from "./routes/searchkeywordRoutes.js";
import categoryclicksRoutes from "./routes/categoryclicksRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import sdashboardRoutes from "./routes/sdashboardRoutes.js";
import allmodsRoutes from "./routes/allmodsRoutes.js";

import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";

const app = express();

/* -------------------- Upload Path -------------------- */
const uploadRoot =
  env.localUploadBase.split(/[\\/]/).filter(Boolean)[0] || "uploads";

/* -------------------- Middleware -------------------- */

app.set("trust proxy", true);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

/* -------------------- Static -------------------- */
if (process.env.VERCEL || !env.localUploadBase) {
  // No static on Vercel/serverless (SFTP uploads)
} else {
  app.use("/uploads", express.static(path.join(process.cwd(), uploadRoot)));
}

/* -------------------- Health + Root -------------------- */

app.get("/", (req, res) => {
  res.json("Server is running..");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "addon-dashboard-backend" });
});

app.get("/api/ip", (req, res) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipFromHeader = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || "")
        .split(",")[0]
        .trim();

  res.json({
    ip: ipFromHeader || req.ip || req.socket.remoteAddress || null,
  });
});

/* -------------------- Routes -------------------- */

// New structured routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mods", modsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/cron", cronRoutes);

// Old/custom routes
app.use("/api/upload", uploadRoutes);
app.use("/api/modanalysis", analysisRoutes);
app.use("/api/categoryclicks", categoryclicksRoutes);
app.use("/api/searchkeyword", searchkeywordRoutes);
app.use("/api/allmods", allmodsRoutes);
app.use("/api", sdashboardRoutes);

/* -------------------- Error Handling -------------------- */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

