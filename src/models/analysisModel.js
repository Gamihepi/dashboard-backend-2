import db from "../db.js"
import moment from "moment";

export const getAlldata = (
  type,
  platform,
  dateRange,
  startDate,
  endDate,
  freeOrPremium,   
  category,
  subCategory,
  country,
  callback
) => {

  const normalizedType = type?.toLowerCase().trim();
  const normalizedPlatform = platform?.toLowerCase().trim();
  const normalizedFreeType = freeOrPremium?.toLowerCase().trim();

  const today = moment().startOf("day");
  let start = null;
  let end = null;

  switch (dateRange) {
    case "today": start = end = today; break;
    case "yesterday": start = end = today.clone().subtract(1, "days"); break;
    case "last7": start = today.clone().subtract(6, "days"); end = today; break;
    case "last30": start = today.clone().subtract(29, "days"); end = today; break;
    case "last90": start = today.clone().subtract(89, "days"); end = today; break;
    case "custom":
      if (!startDate || !endDate || !moment(startDate).isValid() || !moment(endDate).isValid()) {
        return callback(new Error("Invalid custom date range"));
      }
      start = moment(startDate);
      end = moment(endDate);
      break;
    case "alltime": start = end = null; break;
  }

  const coinColumn = normalizedPlatform === "android" ? "m.android_coins" : "m.coin";

  let filters = "WHERE 1=1";
  const params = [];

  // Platform
  if (normalizedPlatform) {
    filters += " AND LOWER(a.platform) = ?";
    params.push(normalizedPlatform);
  }

  // Country
  if (country && country !== "all") {
    filters += " AND LOWER(a.country) = LOWER(?)";
    params.push(country);
  }

  // Date
  if (start && end) {
    filters += " AND DATE(a.create_date) BETWEEN ? AND ?";
    params.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }

  // Join table filters
  if (normalizedFreeType === "free") filters += ` AND ${coinColumn} = 0`;
  if (normalizedFreeType === "premium") filters += ` AND ${coinColumn} > 0`;
 if (category && category !== "all") {
  filters += " AND LOWER(m.category) = LOWER(?)";
  params.push(category);
}

if (subCategory && subCategory !== "all") {
  filters += " AND LOWER(m.sub_category) = LOWER(?)";
  params.push(subCategory);
}

  const joinQuery = `INNER JOIN snap_tech_modsforminecraft_modsData m ON a.post_id = m.post_id`;

  const impressionTable = "snap_tech_modsforminecraft_impressioncount_store";
  const downloadTable = "snap_tech_modsforminecraft_downloadcount_store";

  const sql = `
 SELECT country, COUNT(DISTINCT post_id) AS total
FROM (
  SELECT a.country, a.post_id
  FROM snap_tech_modsforminecraft_impressioncount_store a
  INNER JOIN snap_tech_modsforminecraft_modsData m
  ON a.post_id = m.post_id
  ${filters}

  UNION

  SELECT a.country, a.post_id
  FROM snap_tech_modsforminecraft_downloadcount_store a
  INNER JOIN snap_tech_modsforminecraft_modsData m
  ON a.post_id = m.post_id
  ${filters}

) combined
GROUP BY country
ORDER BY total DESC
  `

  db.query(sql, [...params, ...params], callback);
};


export const getModStats = (
  type,
  platform,
  dateRange,
  startDate,
  endDate,
  freeOrPremium,
  category,
  subCategory,
  country,  
  page =  1,
  limit = 10,
  callback
) => {

  const normalizedPlatform = platform?.toLowerCase().trim();
  const normalizedFreeType = freeOrPremium?.toLowerCase().trim();
  const normalizedType = type?.toLowerCase().trim();

  const coinColumn =
    normalizedPlatform === "android" ? "m.android_coins" : "m.coin";

    page = Number(page) || 1;
limit = Number(limit) || 10;

  const offset = (page - 1) * limit;

  let start = null;
  let end = null;

  const today = moment().startOf("day");

  switch (dateRange) {
    case "today":
      start = today;
      end = today;
      break;
    case "yesterday":
      start = today.clone().subtract(1, "day");
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
  }

  // -----------------------
  // FILTER BUILDING
  // -----------------------

  let where = "WHERE 1=1";
  const mainParams = [];

  if (normalizedFreeType === "free") {
    where += ` AND ${coinColumn} = 0`;
  }

  if (normalizedFreeType === "premium") {
    where += ` AND ${coinColumn} > 0`;
  }

  if (category && category !== "all") {
    where += " AND LOWER(m.category) = LOWER(?)";
    mainParams.push(category);
  }

  if (subCategory && subCategory !== "all") {
    where += " AND LOWER(m.sub_category) = LOWER(?)";
    mainParams.push(subCategory);
  }

  // -----------------------
  // STATS TABLE FILTERS
  // -----------------------

  let statsFilter = "1=1";
  const statsParams = [];

  if (normalizedPlatform) {
    statsFilter += " AND LOWER(platform) = ?";
    statsParams.push(normalizedPlatform);
  }
  if (country && country !== "all") {
  statsFilter += " AND LOWER(country) = LOWER(?)";
  statsParams.push(country);
}

  if (start && end) {
    statsFilter += " AND DATE(create_date) BETWEEN ? AND ?";
    statsParams.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }

  // -----------------------
  // ORDER
  // -----------------------

  let orderBy = "ORDER BY impression_total DESC";

  if (normalizedType === "download") {
    orderBy = "ORDER BY download_total DESC";
  }

  // -----------------------
  // MAIN QUERY
  // -----------------------

  const sql = `
SELECT
  m.post_id,
  m.name AS mod_name,
  m.file_format,
  m.title_for_path,
  m.image_url,
  m.description,
  ${coinColumn} AS coin,
  m.category,
  m.sub_category,
  m.version,

    IFNULL(i.impression_total,0) AS impression_total,
    IFNULL(d.download_total,0) AS download_total

FROM snap_tech_modsforminecraft_modsData m

LEFT JOIN (
    SELECT 
        post_id,
       
        COUNT(*) AS impression_total
    FROM snap_tech_modsforminecraft_impressioncount_store
    WHERE  ${statsFilter}
    GROUP BY post_id
) i ON m.post_id = i.post_id

LEFT JOIN (
    SELECT 
        post_id,
       
        COUNT(*) AS download_total
    FROM snap_tech_modsforminecraft_downloadcount_store
    WHERE ${statsFilter}
    GROUP BY post_id
) d ON m.post_id = d.post_id

${where}
AND (i.post_id IS NOT NULL OR d.post_id IS NOT NULL)


${orderBy}

LIMIT ? OFFSET ?
`;

  // -----------------------
  // TOTAL STATS QUERY
  // -----------------------

  const statsSql = `
SELECT
  COUNT(*) AS totalMods,
  SUM(impression_total) AS totalImpressions,
  SUM(download_total) AS totalDownloads
FROM (

  SELECT
    m.post_id,
    IFNULL(i.impression_total,0) AS impression_total,
    IFNULL(d.download_total,0) AS download_total

  FROM snap_tech_modsforminecraft_modsData m

  LEFT JOIN (
      SELECT post_id, COUNT(*) AS impression_total
      FROM snap_tech_modsforminecraft_impressioncount_store
      WHERE ${statsFilter}
      GROUP BY post_id
  ) i ON m.post_id = i.post_id

  LEFT JOIN (
      SELECT post_id, COUNT(*) AS download_total
      FROM snap_tech_modsforminecraft_downloadcount_store
      WHERE ${statsFilter}
      GROUP BY post_id
  ) d ON m.post_id = d.post_id

  ${where}
  AND (m.post_id = i.post_id OR m.post_id = d.post_id)

) t
`;

  // -----------------------
  // TOP MOD QUERY
  // -----------------------


  const topModSql = `
SELECT
  m.post_id,
  m.name AS mod_name,
  m.file_format,
  m.title_for_path,
  m.image_url,
  m.description,
  ${coinColumn} AS coin,
  m.category,
  m.sub_category,
  m.version,

  IFNULL(i.impression_total,0) AS impression_total,
  IFNULL(d.download_total,0) AS download_total

FROM snap_tech_modsforminecraft_modsData m

LEFT JOIN (
  SELECT post_id, COUNT(*) AS impression_total
  FROM snap_tech_modsforminecraft_impressioncount_store
  WHERE ${statsFilter}
  GROUP BY post_id
) i ON m.post_id = i.post_id

LEFT JOIN (
  SELECT post_id, COUNT(*) AS download_total
  FROM snap_tech_modsforminecraft_downloadcount_store
  WHERE ${statsFilter}
  GROUP BY post_id
) d ON m.post_id = d.post_id

${where}
AND (m.post_id = i.post_id OR m.post_id = d.post_id)

${orderBy}
LIMIT 1
`;


const topDownloadSql = `
SELECT
  m.post_id,
  m.name AS mod_name,
  totals.download_total,
  MAX(d.country) AS country
FROM snap_tech_modsforminecraft_modsData m

LEFT JOIN (
    SELECT post_id, COUNT(*) AS download_total
    FROM snap_tech_modsforminecraft_downloadcount_store
    WHERE ${statsFilter}
    GROUP BY post_id
) totals ON m.post_id = totals.post_id

LEFT JOIN snap_tech_modsforminecraft_downloadcount_store d
  ON m.post_id = d.post_id
  AND ${statsFilter}

WHERE totals.download_total IS NOT NULL

GROUP BY m.post_id
ORDER BY totals.download_total DESC
LIMIT 5
`;

const topImpressionSql = `
SELECT
  m.post_id,
  m.name AS mod_name,
  totals.impression_total,
  MAX(i.country) AS country
FROM snap_tech_modsforminecraft_modsData m

LEFT JOIN (
    SELECT post_id, COUNT(*) AS impression_total
    FROM snap_tech_modsforminecraft_impressioncount_store
    WHERE ${statsFilter}
    GROUP BY post_id
) totals ON m.post_id = totals.post_id

LEFT JOIN snap_tech_modsforminecraft_impressioncount_store i
  ON m.post_id = i.post_id
  AND ${statsFilter}

WHERE totals.impression_total IS NOT NULL

GROUP BY m.post_id
ORDER BY totals.impression_total DESC
LIMIT 5
`;

const topConversionSql = `
SELECT
  m.post_id,
  m.name AS mod_name,
  IFNULL(i.impression_total,0) AS impressions,
  IFNULL(d.download_total,0) AS downloads,
  MAX(ic.country) AS country,

  CASE 
    WHEN IFNULL(i.impression_total,0) = 0 
    THEN 0
    ELSE ROUND((d.download_total / i.impression_total) * 100,2)
  END AS conversion_rate

FROM snap_tech_modsforminecraft_modsData m

LEFT JOIN (
  SELECT post_id, COUNT(*) AS impression_total
  FROM snap_tech_modsforminecraft_impressioncount_store
  WHERE ${statsFilter}
  GROUP BY post_id
) i 
ON m.post_id = i.post_id

LEFT JOIN (
  SELECT post_id, COUNT(*) AS download_total
  FROM snap_tech_modsforminecraft_downloadcount_store
  WHERE ${statsFilter}
  GROUP BY post_id
) d 
ON m.post_id = d.post_id

LEFT JOIN snap_tech_modsforminecraft_impressioncount_store ic
  ON m.post_id = ic.post_id
  AND ${statsFilter}

WHERE i.impression_total > 0

GROUP BY m.post_id
ORDER BY conversion_rate DESC
LIMIT 5
`;

const topDownloadCountrySql = `
SELECT 
  country,
  COUNT(*) AS total,
  ROUND((COUNT(*) * 100.0 / (
      SELECT COUNT(*) 
      FROM snap_tech_modsforminecraft_downloadcount_store
      WHERE ${statsFilter}
  )),0) AS percentage
FROM snap_tech_modsforminecraft_downloadcount_store
WHERE ${statsFilter}
GROUP BY country
ORDER BY total DESC
LIMIT 5
`;

const topImpressionCountrySql = `
SELECT 
  country,
  COUNT(*) AS total,
  ROUND((COUNT(*) * 100.0 / (
      SELECT COUNT(*) 
      FROM snap_tech_modsforminecraft_impressioncount_store
      WHERE ${statsFilter}
  )),0) AS percentage
FROM snap_tech_modsforminecraft_impressioncount_store
WHERE ${statsFilter}
GROUP BY country
ORDER BY total DESC
LIMIT 5
`;

const topConversionCountrySql = `
SELECT 
  i.country,
  COUNT(*) AS total,
  ROUND(
    (SUM(CASE WHEN d.post_id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) * 100,
  2) AS conversion_rate
FROM snap_tech_modsforminecraft_impressioncount_store i

LEFT JOIN snap_tech_modsforminecraft_downloadcount_store d
  ON i.post_id = d.post_id
  AND i.country = d.country

WHERE 1=1
${normalizedPlatform ? "AND LOWER(i.platform) = ?" : ""}
${country && country !== "all" ? "AND LOWER(i.country) = LOWER(?)" : ""}
${start && end ? "AND DATE(i.create_date) BETWEEN ? AND ?" : ""}

GROUP BY i.country
ORDER BY conversion_rate DESC
LIMIT 5
`;

  // -----------------------
  // PARAM BUILDING
  // -----------------------

  const statsQueryParams = [
    ...statsParams,
    ...statsParams,
    ...mainParams
  ];

  const mainQueryParams = [
    ...statsParams,
    ...statsParams,
    ...mainParams,
    Number(limit),
    Number(offset)
  ];

  // -----------------------
  // EXECUTION
  // -----------------------

  db.query(statsSql, statsQueryParams, (err, statsResult) => {
  if (err) return callback(err);

  const stats = statsResult[0] || {};

  const total = stats.totalMods || 0;
  const totalImpressions = stats.totalImpressions || 0;
  const totalDownloads = stats.totalDownloads || 0;

  const topParams = [
    ...statsParams,
    ...statsParams,
    ...mainParams
  ];

  db.query(topModSql, topParams, (err, topResult) => {
  if (err) return callback(err);

  const topMod = topResult.length ? topResult[0] : null;

 db.query(topDownloadSql, [...statsParams, ...statsParams], (err, topDownloads) => {
  if (err) return callback(err);

  db.query(topImpressionSql, [...statsParams, ...statsParams], (err2, topImpressions) => {
    if (err2) return callback(err2);

   db.query(topConversionSql, [...statsParams, ...statsParams, ...statsParams], (err3, topConversions) => {
  if (err3) return callback(err3);

  db.query(topDownloadCountrySql, [...statsParams, ...statsParams], (err4, topDownloadCountries) => {
    if (err4) return callback(err4);

    db.query(topImpressionCountrySql, [...statsParams, ...statsParams], (err5, topImpressionCountries) => {
      if (err5) return callback(err5);

      db.query(topConversionCountrySql, [...statsParams], (err6, topConversionCountries) => {
         if (err6) return callback(err6);

      db.query(sql, mainQueryParams, (err6, rows) => {
        if (err6) return callback(err6);

        callback(null, {
          total,
          totalImpressions,
          totalDownloads,
          topMod,
          topDownloads,
          topImpressions,
          topConversions,
          topDownloadCountries,
          topImpressionCountries,
          topConversionCountries,
          page,
          limit,
          data: rows
        });
      });
      });
    });
  });
});

  });
});
});
});
};

export const getModCountryStats = (
  post_id,
  platform,
  dateRange,
  startDate,
  endDate,
  callback
) => {

  const normalizedPlatform = platform?.toLowerCase().trim();

  const today = moment().startOf("day");
  let start = null;
  let end = null;

  switch (dateRange) {
    case "today":
      start = end = today;
      break;
    case "yesterday":
      start = end = today.clone().subtract(1, "days");
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
  }

  let where = "WHERE post_id = ?";
  const params = [post_id];

  if (normalizedPlatform) {
    where += " AND LOWER(platform) = ?";
    params.push(normalizedPlatform);
  }

  if (start && end) {
    where += " AND DATE(create_date) BETWEEN ? AND ?";
    params.push(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  }


  
  // ------------------------
  // Country wise
  // ------------------------

  const impressionQuery = `
    SELECT country, COUNT(*) AS total
    FROM snap_tech_modsforminecraft_impressioncount_store
    ${where}
    GROUP BY country
    ORDER BY total DESC
  `;

  const downloadQuery = `
    SELECT country, COUNT(*) AS total
    FROM snap_tech_modsforminecraft_downloadcount_store
    ${where}
    GROUP BY country
    ORDER BY total DESC
  `;

  // ------------------------
  // Last 30 days stats
  // ------------------------

  const last30ImpressionQuery = `
    SELECT COUNT(*) AS impressions
    FROM snap_tech_modsforminecraft_impressioncount_store
    WHERE post_id = ?
    AND LOWER(platform) = ?
    AND create_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `;

  const last30DownloadQuery = `
    SELECT COUNT(*) AS downloads
    FROM snap_tech_modsforminecraft_downloadcount_store
    WHERE post_id = ?
    AND LOWER(platform) = ?
    AND create_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `;

  // ------------------------
  // All time stats
  // ------------------------

  const totalImpressionQuery = `
    SELECT COUNT(*) AS impressions
    FROM snap_tech_modsforminecraft_impressioncount_store
    WHERE post_id = ?
    AND LOWER(platform) = ?
  `;

  const totalDownloadQuery = `
    SELECT COUNT(*) AS downloads
    FROM snap_tech_modsforminecraft_downloadcount_store
    WHERE post_id = ?
    AND LOWER(platform) = ?
  `;

  db.query(impressionQuery, params, (err, impressions) => {
    if (err) return callback(err);

    db.query(downloadQuery, params, (err2, downloads) => {
      if (err2) return callback(err2);

      db.query(last30ImpressionQuery, [post_id,normalizedPlatform], (err3, i30) => {
        if (err3) return callback(err3);

        db.query(last30DownloadQuery, [post_id,normalizedPlatform], (err4, d30) => {
          if (err4) return callback(err4);

          db.query(totalImpressionQuery, [post_id,normalizedPlatform], (err5, itotal) => {
            if (err5) return callback(err5);

            db.query(totalDownloadQuery, [post_id,normalizedPlatform], (err6, dtotal) => {
              if (err6) return callback(err6);

              const impressions30 = i30[0].impressions || 0;
              const downloads30 = d30[0].downloads || 0;

              const conversionRate =
                impressions30 > 0
                  ? ((downloads30 / impressions30) * 100).toFixed(1)
                  : 0;

              callback(null, {
                impressions,
                downloads,

                last30Days: {
                  impressions: impressions30,
                  downloads: downloads30,
                  conversionRate: conversionRate
                },

                allTime: {
                  impressions: itotal[0].impressions || 0,
                  downloads: dtotal[0].downloads || 0
                }
              });

            });
          });
        });
      });
    });
  });
};