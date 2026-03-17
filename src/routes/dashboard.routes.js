import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { buildDateSql, toMysqlInPlaceholders } from "../utils/queryFilters.js";
import { EXCLUDED_DEVICE_IDS } from "../utils/constants.js";

const router = express.Router();

const TABLES = {
  mods: "modscraft_modsData",
  categoryClicks: "modscraft_category_click",
  downloads: "modscraft_downloadcount_store",
  impressions: "modscraft_impressioncount_store",
  searchKeywords: "modscraft_android_searchkeyword"
};

function normalizeOption(option) {
  const allowed = new Set([
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "last_90_days",
    "custom",
    "all_keyword"
  ]);
  return allowed.has(option) ? option : "last_30_days";
}

function getCountryCountQueryConfig(type) {
  switch (type) {
    case "mods_clicks":
      return { table: TABLES.downloads, dateColumn: "create_date", useDeviceFilter: true };
    case "mods_impressions":
      return { table: TABLES.impressions, dateColumn: "create_date", useDeviceFilter: true };
    case "search_keywords":
      return { table: TABLES.searchKeywords, dateColumn: "search_date", useDeviceFilter: true };
    case "category_clicks":
      return { table: TABLES.categoryClicks, dateColumn: "create_date", useDeviceFilter: false };
    default:
      return null;
  }
}

function buildCommonWhere({
  option,
  startDate,
  endDate,
  country,
  dateColumn,
  useDeviceFilter,
  tableAlias = ""
}) {
  const withAlias = (column) => (tableAlias ? `${tableAlias}.${column}` : column);
  const date = buildDateSql(option, startDate, endDate, withAlias(dateColumn));
  const whereParts = [date.sql, `${withAlias("platform")} = 'android'`];
  const params = [...date.params];

  if (useDeviceFilter) {
    whereParts.push(`${withAlias("device_id")} NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`);
    params.push(...EXCLUDED_DEVICE_IDS);
  }

  if (country !== "all_countries") {
    whereParts.push(`${withAlias("country")} = ?`);
    params.push(country);
  }

  return {
    sql: whereParts.join(" AND "),
    params
  };
}

async function countRows(table, whereSql, params) {
  const [rows] = await pool.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${whereSql}`, params);
  return Number(rows[0]?.total || 0);
}

async function topRows(sql, params, mapper) {
  const [rows] = await pool.execute(sql, params);
  return rows.map(mapper);
}

router.get(
  "/overview",
  requireAuth,
  requirePermission("dashboard", "view"),
  asyncHandler(async (req, res) => {
    const option = normalizeOption(String(req.query.option || "last_30_days"));
    const country = String(req.query.country || "all_countries");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    const categoryFilter = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      useDeviceFilter: false
    });
    const clickFilter = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      useDeviceFilter: true
    });
    const clickFilterAliased = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      useDeviceFilter: true,
      tableAlias: "c"
    });
    const impressionFilter = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      useDeviceFilter: true
    });
    const impressionFilterAliased = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      useDeviceFilter: true,
      tableAlias: "i"
    });
    const searchFilter = buildCommonWhere({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "search_date",
      useDeviceFilter: true
    });

    const totalsPromise = Promise.all([
      countRows(TABLES.categoryClicks, categoryFilter.sql, categoryFilter.params),
      countRows(TABLES.downloads, clickFilter.sql, clickFilter.params),
      countRows(TABLES.impressions, impressionFilter.sql, impressionFilter.params),
      countRows(TABLES.searchKeywords, searchFilter.sql, searchFilter.params)
    ]);

    const categoryChartPromise = topRows(
      `SELECT category AS label, COUNT(*) AS value
       FROM ${TABLES.categoryClicks}
       WHERE ${categoryFilter.sql}
       GROUP BY category
       ORDER BY value DESC
       LIMIT 12`,
      categoryFilter.params,
      (row) => ({ label: row.label || "Unknown", value: Number(row.value || 0) })
    );

    const modClicksChartPromise = topRows(
      `SELECT
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', c.post_id)) AS label,
          COUNT(*) AS value
       FROM ${TABLES.downloads} c
       LEFT JOIN ${TABLES.mods} m ON m.post_id = c.post_id
       WHERE ${clickFilterAliased.sql}
       GROUP BY c.post_id, m.name
       ORDER BY value DESC
       LIMIT 12`,
      clickFilterAliased.params,
      (row) => ({ label: row.label || "Mod", value: Number(row.value || 0) })
    );

    const modImpressionsChartPromise = topRows(
      `SELECT
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', i.post_id)) AS label,
          COUNT(*) AS value
       FROM ${TABLES.impressions} i
       LEFT JOIN ${TABLES.mods} m ON m.post_id = i.post_id
       WHERE ${impressionFilterAliased.sql}
       GROUP BY i.post_id, m.name
       ORDER BY value DESC
       LIMIT 12`,
      impressionFilterAliased.params,
      (row) => ({ label: row.label || "Mod", value: Number(row.value || 0) })
    );

    const searchChartPromise = topRows(
      `SELECT search_keyword AS label, COUNT(*) AS value
       FROM ${TABLES.searchKeywords}
       WHERE ${searchFilter.sql}
       GROUP BY search_keyword
       ORDER BY value DESC
       LIMIT 12`,
      searchFilter.params,
      (row) => ({ label: row.label || "N/A", value: Number(row.value || 0) })
    );

    const conversionChartPromise = topRows(
      `SELECT
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', i.post_id)) AS label,
          ROUND(100 * COALESCE(c.clicks, 0) / i.impressions, 2) AS value
       FROM (
         SELECT post_id, COUNT(*) AS impressions
         FROM ${TABLES.impressions}
         WHERE ${impressionFilter.sql}
         GROUP BY post_id
         HAVING COUNT(*) >= 10
       ) i
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS clicks
         FROM ${TABLES.downloads}
         WHERE ${clickFilter.sql}
         GROUP BY post_id
       ) c ON c.post_id = i.post_id
       LEFT JOIN ${TABLES.mods} m ON m.post_id = i.post_id
       ORDER BY value DESC
       LIMIT 12`,
      [...impressionFilter.params, ...clickFilter.params],
      (row) => ({ label: row.label || "Mod", value: Number(row.value || 0) })
    );

    const [
      [categoryClicks, modClicks, modImpressions, searchKeywords],
      categoryChart,
      modClicksChart,
      modImpressionsChart,
      searchChart,
      conversionChart
    ] = await Promise.all([
      totalsPromise,
      categoryChartPromise,
      modClicksChartPromise,
      modImpressionsChartPromise,
      searchChartPromise,
      conversionChartPromise
    ]);

    return res.json({
      totals: {
        categoryClicks,
        modClicks,
        modImpressions,
        searchKeywords
      },
      categoryChart,
      modClicksChart,
      modImpressionsChart,
      searchChart,
      conversionChart
    });
  })
);

router.get(
  "/country-counts",
  requireAuth,
  requirePermission("dashboard", "view"),
  asyncHandler(async (req, res) => {
    const type = String(req.query.type || "mods_impressions");
    const option = normalizeOption(String(req.query.option || "last_30_days"));
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    const config = getCountryCountQueryConfig(type);
    if (!config) {
      return res.status(400).json({ error: "Unsupported type" });
    }

    const filter = buildCommonWhere({
      option,
      startDate,
      endDate,
      country: "all_countries",
      dateColumn: config.dateColumn,
      useDeviceFilter: config.useDeviceFilter
    });

    const [rows] = await pool.execute(
      `SELECT country, COUNT(*) AS cnt
       FROM ${config.table}
       WHERE ${filter.sql} AND country IS NOT NULL AND country <> ''
       GROUP BY country
       ORDER BY cnt DESC`,
      filter.params
    );

    const output = {};
    let allCountries = 0;
    rows.forEach((row) => {
      const code = String(row.country || "").trim();
      const count = Number(row.cnt || 0);
      if (!code || count <= 0) {
        return;
      }
      output[code] = count;
      allCountries += count;
    });
    output.all_countries = allCountries;

    return res.json(output);
  })
);

router.get(
  "/countries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT country, COUNT(*) AS cnt
       FROM ${TABLES.searchKeywords}
       WHERE platform = 'android' AND country IS NOT NULL AND country <> ''
       GROUP BY country
       ORDER BY cnt DESC
       LIMIT 500`
    );

    const countries = rows.map((row) => row.country).filter(Boolean);
    return res.json({ countries });
  })
);

export default router;
