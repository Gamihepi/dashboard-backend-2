import express from "express";
import {  fetchCountriesByFilter, getDashboardData } from "../controller/dashboardController.js";

const router = express.Router();

router.get("/secretebase/dashboard/filter", getDashboardData);

router.get("/secretebase/countries-count", fetchCountriesByFilter);

export default router;