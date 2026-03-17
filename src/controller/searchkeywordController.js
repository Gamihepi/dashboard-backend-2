
import { getAllCountries, getAndroidKeywords, getCountriesByKeyword, getDistinctKeywordCountByPlatform, getiOSKeywords, getKeywordsByDateRange, getKeywordWordCountByPlatform, getModsByKeywords,  getSearchKeyword,  getTopKeywordByPlatform, getTotalKeywordCountByPlatform } from "../models/searchkeywordModel.js";
import { translateToEnglish } from "../utils/translate.js";

export const fetchsearchiOS = (req, res) => {
  getiOSKeywords((err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

export const fetchsearchAndroid =(req,res) => {
 getAndroidKeywords((err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
}

export const fetchKeywords = (req, res) => {
  const { platform } = req.query;
  
  const search = req.query.search ? String(req.query.search) : ""; 
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 300;

  if (!platform) {
    return res.status(400).json({ message: "Platform is required" });
  }

  getKeywordWordCountByPlatform(platform, page, limit, search , (err, results) => {
  
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({ page,
      limit,
      search,
      data: results});
  });
};

export const fetchDistinctKeywordCount = (req, res) => {
  const { platform } = req.query;

  const search = req.query.search ? String(req.query.search) : "";  // ✅ SAFE

  getDistinctKeywordCountByPlatform(platform, search, (err, results) => {
    if (err) return res.status(400).json({ error: err.message });

    res.json({
      platform,
      search,
      total: results[0].total
    });
  });
};

export const fetchTotalKeywordCount = (req, res) => {
  const { platform, search = "" } = req.query;

  getTotalKeywordCountByPlatform(
    platform,
    search,
    (err, results) => {
      if (err) {
        console.error("Total Count Error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json(results[0]); // { total: number }
    }
  );
};


export const fetchTopKeyword = (req, res) => {
  const { platform, search = "" } = req.query;

  if (!platform) {
    return res.status(400).json({ message: "Platform is required" });
  }

  getTopKeywordByPlatform(platform, search, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results[0] || null);
  });
};

export const fetchKeywordsByDateRange = (req, res) => {
  const { platform, dateRange = "last30", startDate, endDate, page = 1, limit = 200, search = "",    country = ""  ,   search_keyword = ""  } = req.query;

  if (!platform) return res.status(400).json({ message: "Platform is required" });

  getKeywordsByDateRange(platform, dateRange, startDate, endDate, parseInt(page), parseInt(limit), search, country,  search_keyword , (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    // result: { totalCount, data }
    res.json(result);
  });
};

export const fetchAllCountries = (req, res) => {
  const { platform, dateRange, startDate, endDate, search   } = req.query;

  getAllCountries(platform,  dateRange, startDate, endDate, search ,(err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
};

export const fetchCountriesByKeyword = async (req, res) => {
  try {
    const { platform, dateRange, startDate, endDate, searchKeyword } = req.query;

    if (!searchKeyword) return res.status(400).json({ error: "searchKeyword is required" });

    const countries = await getCountriesByKeyword({
      platform,
      dateRange,
      startDate,
      endDate,
      searchKeyword
    });

    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const searchMods = (req, res) => {
  const { platform, keyword } = req.body;

  if (!platform)
    return res.status(400).json({ error: "Platform is required" });

  if (!keyword || keyword.trim() === "")
    return res.status(400).json({ error: "Keyword is required" });

  translateToEnglish(keyword, (err, englishKeyword) => {

    englishKeyword = (englishKeyword || keyword)
      .toLowerCase()
      .trim()
      .replace(/â€™|’|`/g, "'")
      .replace(/[^a-z0-9\s']/g, " "); // remove special chars

    //Split into words
    const words = englishKeyword
      .split(/\s+/)
      .filter(word => word.length > 2); // ignore small words like "at"

    if (words.length === 0) {
      return res.json({
        originalKeyword: keyword,
        translatedKeyword: englishKeyword,
        totalCount: 0,
        matchedKeywords: [],
        mods: [],
      });
    }

    //Search mods using individual words
    getModsByKeywords(words, (err, mods) => {

      if (err)
        return res.status(500).json({ error: "Server Error" });

      res.json({
        originalKeyword: keyword,
        translatedKeyword: englishKeyword,
        totalCount: mods ? mods.length : 0,
        matchedKeywords: words,
        mods: mods || [],
      });

    });
  });
};