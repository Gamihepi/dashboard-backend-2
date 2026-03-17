import db from "../db.js"
import moment from "moment";

export const categoryclicks = (callback) => {
    db.query("SELECT category , count(*) AS total FROM snap_tech_modsforminecraft_category_click GROUP BY category ORDER BY total DESC ", callback);
}

export const getCategoryClicksByPlatform = (
  platform,
  country,
  dateRange,
  startDate,
  endDate,
  callback
) => {
  let query = `
    SELECT category, country, COUNT(*) AS total
    FROM snap_tech_modsforminecraft_category_click
    WHERE 1=1
  `;

  const queryParams = [];

  // Platform filter
  if (platform) {
    query += ` AND LOWER(platform) = ?`;
    queryParams.push(platform.toLowerCase());
  }

  // Country filter
  if (country) {
    query += ` AND country = ?`;
    queryParams.push(country);
  }

  // Date range filter
  let start, end;
  const today = moment().startOf("day");

  switch (dateRange) {
    case "today":
      start = today;
      end = today;
      break;
    case "yesterday":
      start = today.clone().subtract(1, "days");
      end = start;
      break;
    case "last7":
      start = today.clone().subtract(6, "days");
      end = today;
      break;
    case "last30":
      start = today.clone().subtract(29, "days");
      end = today;
      break;
    case "last90":
      start = today.clone().subtract(89, "days");
      end = today;
      break;
    case "custom":
      start = moment(startDate);
      end = moment(endDate);
      break;
    case "alltime":
    default:
      start = null;
      end = null;
      break;
  }

  if (start && end && start.isValid() && end.isValid()) {
    query += ` AND DATE(create_date) BETWEEN ? AND ?`;
    queryParams.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }

  // Group by category and country to get breakdown
  query += `
    GROUP BY category, country
    ORDER BY total DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) return callback(err);

    // Aggregate results by category (like top keywords function)
    const categoryMap = {};
    results.forEach(row => {
      if (!categoryMap[row.category]) {
        categoryMap[row.category] = [];
      }
      categoryMap[row.category].push({
        country: row.country,
        clicks: row.total
      });
    });

    // Convert to array with total clicks per category
    const categories = Object.entries(categoryMap)
      .map(([category, countries]) => ({
        category,
        total: countries.reduce((sum, c) => sum + c.clicks, 0),
        countries
      }))
      .sort((a, b) => b.total - a.total);

    callback(null, categories);
  });
};

export const getAllCountries = (
  platform,
  dateRange,
  startDate,
  endDate,
  callback
) => {

  let query = `
     SELECT 
      country,
      DATE(create_date) AS click_date,
      COUNT(*) AS total_clicks
    FROM snap_tech_modsforminecraft_category_click
    WHERE 1=1
      AND country IS NOT NULL
      AND country != ''
  `;

  let queryParams = [];

  // Platform filter
  if (platform) {
    query += " AND LOWER(platform) = ?";
    queryParams.push(platform.toLowerCase());
  }

  let start, end;
  const today = moment().startOf("day");

  switch (dateRange) {
    case "today":
      start = today;
      end = today;
      break;
    case "yesterday":
      start = today.clone().subtract(1, "days");
      end = start;
      break;
    case "last7":
      start = today.clone().subtract(6, "days");
      end = today;
      break;
    case "last30":
      start = today.clone().subtract(29, "days");
      end = today;
      break;
    case "last90":
      start = today.clone().subtract(89, "days");
      end = today;
      break;
    case "custom":
  if (startDate && endDate) {
    start = moment(startDate);
    end = moment(endDate);
  }
  break;
    case "alltime":
    default:
      start = null;
      end = null;
      break;
  }

  if (start && end && start.isValid() && end.isValid()) {

  const startDateTime = start.startOf("day").format("YYYY-MM-DD HH:mm:ss");
  const endDateTime = end.endOf("day").format("YYYY-MM-DD HH:mm:ss");

  query += ` AND create_date BETWEEN ? AND ?`;
  queryParams.push(startDateTime, endDateTime);
}

  query += `
    GROUP BY country
    ORDER BY total_clicks DESC
  `;


  db.query(query, queryParams, callback);
};


