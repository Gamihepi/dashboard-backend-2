import express from "express";
const router = express.Router();

import { categoryClicks, fetchAllCountries, fetchCategoryClicks } from "../controller/categoryclicksController.js";

router.get("/secretebase/categoryclicks" , categoryClicks)

router.get("/secretebase/categoryclicksByPlatform", fetchCategoryClicks);

router.get("/secretebase/countries", fetchAllCountries);



export default router;