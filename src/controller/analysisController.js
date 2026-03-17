import { getAlldata,    getModCountryStats,    getModStats } from "../models/analysisModel.js";

export const fetchAlldata = (req, res) => {
  const { type,platform, dateRange, startDate, endDate,  freeOrPremium,   category,
  subCategory, country } = req.query;

  getAlldata(type, platform, dateRange, startDate, endDate,  freeOrPremium,   category,
  subCategory, country,(err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
};

export const fetchModPlatformStats = (req, res) => {
  const {  type, platform, dateRange,
  startDate,
  endDate,
  freeOrPremium,  category, subCategory,  country, downloadCountry,
  impressionCountry,
  conversionCountry,  page, limit} = req.query;

   const pageNumber = parseInt(page) || 1;
  const limitNumber = parseInt(limit) || 10;


  getModStats(
      type,
    platform,
    dateRange,
  startDate,
  endDate,
  freeOrPremium,
    category,
    subCategory,
      country,  
      
    pageNumber,
    limitNumber,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};


export const getModCountryStatsController = (req, res) => {

  const { post_id, platform, dateRange, startDate, endDate } = req.query;

  getModCountryStats(
    post_id,
    platform,
    dateRange,
    startDate,
    endDate,
    (err, result) => {

      if (err) {
        console.error(err);
        return res.status(500).json({ success:false });
      }

      res.json({
        success: true,
        impressions: result.impressions,
        downloads: result.downloads,
         last30Days: result.last30Days,
        allTime: result.allTime
      });

    }
  );
};