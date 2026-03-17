import { categoryclicks, getAllCountries, getCategoryClicksByPlatform } from "../models/categoryclicksModel.js";


export const categoryClicks = (req,res) => {
    categoryclicks((err, result) => {
         if (err) return res.status(500).json(err);
        res.json(result || []);
    });
}

export const fetchCategoryClicks = (req, res) => {
    const platform = req.query.platform; 
    const dateRange = req.query.dateRange || "last30";  
    const startDate = req.query.startDate;     
    const endDate = req.query.endDate;
    const country = req.query.country || "";

    getCategoryClicksByPlatform(platform, country, dateRange, startDate, endDate, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
};

export const fetchAllCountries = (req, res) => {

  const {
    platform,
    dateRange = "last30",
    startDate,
    endDate
  } = req.query;

  getAllCountries(
    platform,
    dateRange,
    startDate,
    endDate,
    (err, result) => {

      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json(result || []);
    }
  );
};


