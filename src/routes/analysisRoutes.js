import express from "express";
import { fetchAlldata, fetchModPlatformStats, getModCountryStatsController } from "../controller/analysisController.js";
const router = express.Router();

router.get("/secretebase/allanalysis", fetchAlldata);

router.get("/secretebase/modplatformstats", fetchModPlatformStats);

router.get("/secretebase/mod-country-stats", getModCountryStatsController);

export default router;