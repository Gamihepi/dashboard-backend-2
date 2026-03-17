
import {  getCountriesByPlatformAndDate, getFilteredTableData } from "../models/dashboardModel.js";

export const getDashboardData = (req, res) => {
  const { platform, country, dateRange, startDate, endDate } = req.query;

  let searchKeywordTable = null;
  if (platform && platform.toLowerCase() === "android") {
    searchKeywordTable = "snap_tech_modsforminecraft_android_modssearchkeyword";
  } else if (platform && platform.toLowerCase() === "ios") {
    searchKeywordTable = "snap_tech_modsforminecraft_modsSearchKeyword";
  }

  const tables = {
    category_clicks: "snap_tech_modsforminecraft_category_click",
    impression_count: "snap_tech_modsforminecraft_impressioncount_store",
    download_count: "snap_tech_modsforminecraft_downloadcount_store",
    search_keyword: searchKeywordTable
  };

  let result = {};
  let completed = 0;

  const validTables = Object.entries(tables).filter(([key, table]) => table);
  const totalTables = validTables.length;

  validTables.forEach(([key, table]) => {
    // select correct date column
    const dateCol = key === "search_keyword" ? "search_date" : "create_date";

    getFilteredTableData(
      table,
      platform,
      country,
      dateRange,
      startDate,
      endDate,
      dateCol,
      (err, data) => {
        if (err) return res.status(500).json(err);

        result[key] = data[0].total;
        completed++;

        if (completed === totalTables) {
          res.json(result);
        }
      }
    );
  });
};



export const fetchCountriesByFilter = (req, res) => {
  const { platform, dateRange, startDate, endDate } = req.query;

  getCountriesByPlatformAndDate(platform, dateRange, startDate, endDate, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
};