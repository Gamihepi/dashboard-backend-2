import db from "../db.js";
import moment from "moment";

export const getiOSKeywords = (callback) => {
  db.query(
    "SELECT * FROM snap_tech_modsforminecraft_modsSearchKeyword",
    callback,
  );
};

export const getAndroidKeywords = (callback) => {
  db.query(
    "SELECT * FROM snap_tech_modsforminecraft_android_modssearchkeyword",
    callback,
  );
};

export const getKeywordWordCountByPlatform = (
  platform,
  page,
  limit = 300,
  search = "",
  callback,
) => {
  const normalizedPlatform = platform.toLowerCase(); // ✅ normalize

  let tableName = "";

  if (normalizedPlatform === "android") {
    tableName = "snap_tech_modsforminecraft_android_modssearchkeyword";
  } else if (normalizedPlatform === "ios") {
    tableName = "snap_tech_modsforminecraft_modsSearchKeyword";
  } else {
    return callback(new Error("Invalid Platform"));
  }
  const offset = (page - 1) * limit;

  const searchString = String(search || "").trim();
  const params = [];
  let sql = `
    SELECT search_keyword, COUNT(*) AS total
    FROM ${tableName}
    
  `;

  // ✅ Add search filter
  if (searchString !== "") {
    sql += ` WHERE LOWER(search_keyword) LIKE ? `;
    params.push(`%${searchString.toLowerCase()}%`);
  }

  sql += `
    GROUP BY search_keyword
    ORDER BY total DESC
    LIMIT ? OFFSET ?
  `;

  params.push(parseInt(limit), parseInt(offset));
  db.query(sql, params, callback);
};

export const getDistinctKeywordCountByPlatform = (
  platform,
  search = "",
  callback,
) => {
  if (!platform) {
    return callback(new Error("Platform is required"));
  }

  const normalizedPlatform = platform.toLowerCase().trim();

  let tableName = "";

  if (normalizedPlatform === "android") {
    tableName = "snap_tech_modsforminecraft_android_modssearchkeyword";
  } else if (normalizedPlatform === "ios") {
    tableName = "snap_tech_modsforminecraft_modsSearchKeyword";
  } else {
    return callback(new Error("Invalid Platform"));
  }
  const searchString = String(search || "").trim();

  let sql = `
    SELECT COUNT(DISTINCT search_keyword) AS total
    FROM ${tableName}
  `;

  const params = [];

  if (searchString !== "") {
    sql += ` WHERE LOWER(search_keyword)LIKE ? `;
    params.push(`%${searchString.toLowerCase()}%`);
  }

  db.query(sql, params, callback);
};

export const getTotalKeywordCountByPlatform = (
  platform,
  search = "",
  callback,
) => {
  const normalizedPlatform = platform.toLowerCase().trim();

  let tableName = "";

  if (normalizedPlatform === "android") {
    tableName = "snap_tech_modsforminecraft_android_modssearchkeyword";
  } else if (normalizedPlatform === "ios") {
    tableName = "snap_tech_modsforminecraft_modsSearchKeyword";
  } else {
    return callback(new Error("Invalid Platform"));
  }

  const searchString = String(search || "").trim();

  let sql = `
    SELECT COUNT(*) AS total
    FROM ${tableName}
  `;

  const params = [];

  if (searchString !== "") {
    sql += ` WHERE LOWER(search_keyword) LIKE ? `;
    params.push(`%${searchString.toLowerCase()}%`);
  }

  db.query(sql, params, callback);
};

export const getTopKeywordByPlatform = (platform, search = "", callback) => {
  const normalizedPlatform = platform.toLowerCase().trim();

  let tableName = "";

  if (normalizedPlatform === "android") {
    tableName = "snap_tech_modsforminecraft_android_modssearchkeyword";
  } else if (normalizedPlatform === "ios") {
    tableName = "snap_tech_modsforminecraft_modsSearchKeyword";
  } else {
    return callback(new Error("Invalid Platform"));
  }

  const searchString = String(search || "").trim();

  let sql = `
    SELECT search_keyword, COUNT(*) AS total
    FROM ${tableName}
  `;

  const params = [];

  if (searchString !== "") {
    sql += ` WHERE LOWER(search_keyword) LIKE ? `;
    params.push(`%${searchString.toLowerCase()}%`);
  }

  sql += `
    GROUP BY search_keyword
    ORDER BY total DESC
    LIMIT 1
  `;

  db.query(sql, params, callback);
};

//final
export const getKeywordsByDateRange = (
  platform,
  dateRange,
  startDate,
  endDate,
  page = 1,
  limit = 200,
  search = "",
  country = "",
  searchKeyword = "",
  callback,
) => {
  const normalizedPlatform = platform.toLowerCase().trim();

  let tableName =
    normalizedPlatform === "android"
      ? "snap_tech_modsforminecraft_android_modssearchkeyword"
      : "snap_tech_modsforminecraft_modsSearchKeyword";

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
      start = null;
      end = null;
      break;
  }

  const offset = (page - 1) * limit;
  const params = [];
  let where = "WHERE 1=1";

  if (start && end) {
    where += " AND DATE(search_date) BETWEEN ? AND ?";
    params.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }

  if (search) {
    where += " AND LOWER(search_keyword) LIKE ?";
    params.push(`%${search.toLowerCase()}%`);
  }

  if (country && country !== "") {
    where += " AND country = ?";
    params.push(country);

    if (searchKeyword) {
      where += " AND search_keyword = ?";
      params.push(searchKeyword);
    }
  }

  // 1️⃣ Total DISTINCT keywords
  const distinctSql = `
    SELECT COUNT(DISTINCT search_keyword) AS totalDistinct
    FROM ${tableName} ${where}
  `;

  db.query(distinctSql, params, (err, distinctResult) => {
    if (err) return callback(err);

    const totalDistinct = distinctResult[0]?.totalDistinct || 0;

    // 2️⃣ Total searches (all rows)
    const totalSql = `
      SELECT COUNT(*) AS totalSearches
      FROM ${tableName} ${where}
    `;

    db.query(totalSql, params, (err, totalResult) => {
      if (err) return callback(err);

      const totalSearches = totalResult[0]?.totalSearches || 0;

      // 3️⃣ Top search keyword
      const topSql = `
        SELECT search_keyword, COUNT(*) AS total
        FROM ${tableName} ${where}
        GROUP BY search_keyword
        ORDER BY total DESC
        LIMIT 1
      `;

      db.query(topSql, params, (err, topResult) => {
        if (err) return callback(err);

        const topSearch = topResult[0] || null;

        // 4️⃣ Paginated keyword list
        const dataSql = `
          SELECT search_keyword, COUNT(*) AS total
          FROM ${tableName} ${where}
          GROUP BY search_keyword
          ORDER BY total DESC
          LIMIT ? OFFSET ?
        `;

        db.query(dataSql, [...params, limit, offset], (err, results) => {
          if (err) return callback(err);

          const countrySql = `
            SELECT 
            country,
            COUNT(DISTINCT search_keyword) AS total,
            ROUND(
              (
                COUNT(DISTINCT search_keyword) * 100.0 /
                (
                  SELECT COUNT(DISTINCT search_keyword)
                  FROM ${tableName} ${where}
                )
              ),
              0
            ) AS percentage
          FROM ${tableName}
          ${where}
          GROUP BY country
          ORDER BY total DESC
          LIMIT 5
          `;

          db.query(
            countrySql,
            [...params, ...params],
            (err2, countryResult) => {
              if (err2) return callback(err2);

              callback(null, {
                totalDistinct,
                totalSearches,
                topSearch,
                topKeywordCountries: countryResult, // ✅ NEW
                data: results,
              });
            },
          );
        });
      });
    });
  });
};

export const getAllCountries = (
  platform,
  dateRange,
  startDate,
  endDate,
  search = "",
  callback,
) => {
  const normalizedPlatform = platform?.toLowerCase().trim();

  let tableName =
    normalizedPlatform === "android"
      ? "snap_tech_modsforminecraft_android_modssearchkeyword"
      : "snap_tech_modsforminecraft_modsSearchKeyword";

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
      start = null;
      end = null;
      break;
  }

  let where = "WHERE 1=1";
  const params = [];

  if (start && end) {
    where += " AND DATE(search_date) BETWEEN ? AND ?";
    params.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }

  if (search) {
    where += " AND LOWER(search_keyword) LIKE ?";
    params.push(`%${search.toLowerCase()}%`);
  }

  const sql = `
    SELECT country, COUNT(DISTINCT search_keyword) AS total
    FROM ${tableName}
    ${where}
    GROUP BY country
    ORDER BY total DESC
  `;

  db.query(sql, params, callback);
};

export const getCountriesByKeyword = ({
  platform,
  dateRange,
  startDate,
  endDate,
  searchKeyword,
}) => {
  return new Promise((resolve, reject) => {
    const normalizedPlatform = platform.toLowerCase().trim();
    const tableName =
      normalizedPlatform === "android"
        ? "snap_tech_modsforminecraft_android_modssearchkeyword"
        : "snap_tech_modsforminecraft_modsSearchKeyword";

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
        start = null;
        end = null;
        break;
    }

    const params = [];
    let where = "WHERE 1=1";

    if (start && end) {
      where += " AND DATE(search_date) BETWEEN ? AND ?";
      params.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
    }

    if (searchKeyword) {
      where += " AND search_keyword = ?";
      params.push(searchKeyword);
    }

    const sql = `
      SELECT country, COUNT(*) AS total
      FROM ${tableName}
      ${where}
      GROUP BY country
      ORDER BY total DESC
    `;

    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

export const getSearchKeyword = (platform, keyword, callback) => {
  const table =
    platform.toLowerCase() === "android"
      ? "snap_tech_modsforminecraft_android_modssearchkeyword"
      : "snap_tech_modsforminecraft_modsSearchKeyword";

  // Word-boundary regex to match exact words
  const regexPattern = `(^|[[:space:][:punct:]])(${keyword})([[:space:][:punct:]]|$)`;

  const sql = `
    SELECT search_keyword
    FROM ${table}
    WHERE search_keyword LIKE ?
       OR LOWER(search_keyword) REGEXP LOWER(?)
  `;

  db.query(sql, [`%${keyword}%`, regexPattern], (err, rows) => {
    if (err) {
      console.error("getSearchKeyword Error:", err);
      return callback(err);
    }
    callback(
      null,
      rows.map((r) => r.search_keyword),
    );
  });
};

export const getModsByKeywords = (keywords, callback) => {
  if (!keywords || keywords.length === 0) return callback(null, []);

  const MAX_KEYWORDS = 25;

  const uniqueKeywords = [
    ...new Set(keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)),
  ].slice(0, MAX_KEYWORDS);

  if (uniqueKeywords.length === 0) return callback(null, []);

  // Escape regex characters
  const safeKeywords = uniqueKeywords.map((k) =>
    k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  // Add optional plural support (s?)
  const pluralPatterns = safeKeywords.map((k) => `${k}(s?)`);

  const combinedPattern = pluralPatterns.join("|");

  const wordBoundaryPattern = `(^|[[:space:][:punct:]])(${combinedPattern})([[:space:][:punct:]]|$)`;

  const firstKeyword = safeKeywords[0];

  const sql = `
    SELECT *
    FROM snap_tech_modsforminecraft_modsData
    WHERE 
      LOWER(name) REGEXP LOWER(?)
      OR LOWER(description) REGEXP LOWER(?)

    ORDER BY
      CASE
        WHEN LOWER(name) = LOWER(?) THEN 1
        WHEN LOWER(name) = LOWER(CONCAT(?, 's')) THEN 2
        WHEN LOWER(name) LIKE LOWER(CONCAT(?, '%')) THEN 3
        WHEN LOWER(name) REGEXP LOWER(?) THEN 4
        ELSE 5
      END,
      download DESC,
      LENGTH(name) ASC,
      name ASC
  `;

  const params = [
    wordBoundaryPattern,
    wordBoundaryPattern,
    firstKeyword,
    firstKeyword,
    firstKeyword,
    wordBoundaryPattern,
  ];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("getModsByKeywords Error:", err);
      return callback(err);
    }
    callback(null, results);
  });
};
