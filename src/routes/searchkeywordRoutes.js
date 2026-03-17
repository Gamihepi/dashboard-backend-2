import express from "express";
import { fetchsearchiOS, fetchsearchAndroid, fetchKeywords, fetchDistinctKeywordCount, fetchTotalKeywordCount, fetchTopKeyword,  fetchKeywordsByDateRange, fetchAllCountries, fetchCountriesByKeyword, searchMods  } from "../controller/searchkeywordController.js";

const router = express.Router();

router.get("/secretebase/iOS_searchkeyword", fetchsearchiOS);

router.get("/secretebase/Android_searchkeyword", fetchsearchAndroid);

router.get("/secretebase/platform", fetchKeywords);

router.get('/secretebase/distnictcount',fetchDistinctKeywordCount);

router.get('/secretebase/totalserachkeyword', fetchTotalKeywordCount)

router.get("/secretebase/searchkeywords/top", fetchTopKeyword);

// router.get("/searchkeywordByDate", fetchByDate)

router.get("/secretebase/searchKeywordsByDateRange", fetchKeywordsByDateRange);

router.get("/secretebase/all-countries", fetchAllCountries);

router.get("/secretebase/keyword/countries", fetchCountriesByKeyword);

router.post("/secretebase/search-mods", searchMods);

export default router;