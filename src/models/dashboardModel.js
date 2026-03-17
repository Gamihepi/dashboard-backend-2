import db from "../db.js";
import moment from "moment";

export const getFilteredTableData = (
  tableName,
  platform,
  country,
  dateRange,
  startDate,
  endDate,
  dateColumn, // pass the correct column name
  callback
) => {
  let query = `SELECT COUNT(*) AS total FROM ${tableName} WHERE 1=1`;
  let params = [];

  // Platform filter
  if (platform) {
    query += ` AND LOWER(platform) = ?`;
    params.push(platform.toLowerCase());
  }

  // Country filter
  if (country) {
    query += ` AND country = ?`;
    params.push(country);
  }

  // Date filter only if not alltime
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
      if (startDate) start = moment(startDate);
      if (endDate) end = moment(endDate);
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

    // Use the correct column for filtering
    query += ` AND ${dateColumn} BETWEEN ? AND ?`;
    params.push(startDateTime, endDateTime);
  }

  db.query(query, params, callback);
};

export const getCountriesByPlatformAndDate = (
  platform,
  dateRange,
  startDate,
  endDate,
  callback
) => {

  let query = `
    SELECT country, COUNT(*) AS total_count
    FROM (
      SELECT platform, country, create_date FROM snap_tech_modsforminecraft_category_click
      UNION ALL
      SELECT platform, country, create_date FROM snap_tech_modsforminecraft_impressioncount_store
      UNION ALL
      SELECT platform, country, create_date FROM snap_tech_modsforminecraft_downloadcount_store
      UNION ALL
      SELECT platform, country, search_date FROM snap_tech_modsforminecraft_android_modssearchkeyword
      UNION ALL
      SELECT platform, country, search_date FROM snap_tech_modsforminecraft_modsSearchKeyword
    ) AS all_data
    WHERE country IS NOT NULL AND country != ''
  `;

  let params = [];

  // Platform filter
  if (platform) {
    query += " AND LOWER(platform) = ?";
    params.push(platform.toLowerCase());
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
      start = startDate ? moment(startDate) : null;
      end = endDate ? moment(endDate) : null;
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
    query += " AND create_date BETWEEN ? AND ?";
    params.push(startDateTime, endDateTime);
  }

  query += `
    GROUP BY country
    ORDER BY total_count DESC
  `;

  db.query(query, params, callback);

};