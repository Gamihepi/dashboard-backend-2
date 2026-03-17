import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getPriceHistorySchema } from "../services/priceHistoryService.js";
import { buildDateSql, parsePagination, toMysqlInPlaceholders } from "../utils/queryFilters.js";
import { EXCLUDED_DEVICE_IDS } from "../utils/constants.js";

const router = express.Router();
const TABLES = {
  mods: "modscraft_modsData",
  categoryClicks: "modscraft_category_click",
  downloads: "modscraft_downloadcount_store",
  impressions: "modscraft_impressioncount_store",
  searchKeywords: "modscraft_android_searchkeyword"
};

function isValidDateValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildHistoryDateSql(option, startDate, endDate, column) {
  const col = String(column || "changed_at");
  switch (option) {
    case "today":
      return { sql: `DATE(${col}) = CURDATE()`, params: [] };
    case "yesterday":
      return { sql: `DATE(${col}) = CURDATE() - INTERVAL 1 DAY`, params: [] };
    case "last_7_days":
      return { sql: `${col} >= CURDATE() - INTERVAL 7 DAY`, params: [] };
    case "last_30_days":
      return { sql: `${col} >= CURDATE() - INTERVAL 30 DAY`, params: [] };
    case "last_90_days":
      return { sql: `${col} >= CURDATE() - INTERVAL 90 DAY`, params: [] };
    case "all_time":
    case "all_keyword":
      return { sql: "1=1", params: [] };
    case "custom":
      if (isValidDateValue(startDate) && isValidDateValue(endDate)) {
        return { sql: `DATE(${col}) BETWEEN ? AND ?`, params: [startDate, endDate] };
      }
      return { sql: "1=1", params: [] };
    default:
      return { sql: `${col} >= CURDATE() - INTERVAL 30 DAY`, params: [] };
  }
}

function parseDateTimeInput(value, defaultTime = "00:00:00") {
  const raw = String(value || "").trim();
  if (!raw) {
    return { valid: false, isDateOnly: false, value: "", dateOnly: "" };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { valid: true, isDateOnly: true, value: `${raw} ${defaultTime}`, dateOnly: raw };
  }

  const normalized = raw.replace("T", " ").slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return { valid: true, isDateOnly: false, value: normalized, dateOnly: "" };
  }

  return { valid: false, isDateOnly: false, value: "", dateOnly: "" };
}

function buildEventFilters({
  option,
  startDate,
  endDate,
  country,
  dateColumn = "create_date",
  includeDeviceFilter = true,
  tableAlias = ""
}) {
  const withAlias = (column) => (tableAlias ? `${tableAlias}.${column}` : column);
  const dateColumnSql =
    tableAlias && !String(dateColumn).includes(".") ? withAlias(dateColumn) : dateColumn;
  const date = buildDateSql(option, startDate, endDate, dateColumnSql);
  const whereParts = [date.sql, `${withAlias("platform")} = 'android'`];
  const params = [...date.params];

  if (includeDeviceFilter) {
    whereParts.push(`${withAlias("device_id")} NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`);
    params.push(...EXCLUDED_DEVICE_IDS);
  }

  if (country && country !== "all_countries") {
    whereParts.push(`${withAlias("country")} = ?`);
    params.push(country);
  }

  return { sql: whereParts.join(" AND "), params };
}

function escapeLikeValue(value) {
  return String(value || "").replace(/[\\%_]/g, "\\$&");
}

const SEARCH_STOPWORDS = new Set(
  [
    "in",
    "on",
    "under",
    "and",
    "but",
    "or",
    "for",
    "with",
    "to",
    "of",
    "from",
    "as",
    "as if",
    "if",
    "nor",
    "equal",
    "so that",
    "than",
    "that",
    "though",
    "unless",
    "until",
    "when",
    "where",
    "whether",
    "and while",
    "i",
    "the",
    "else",
    "it",
    "be",
    "am",
    "is",
    "are",
    "not",
    "was",
    "were",
    "being",
    "been",
    "has",
    "have",
    "had",
    "do",
    "does",
    "did",
    "can",
    "will",
    "shall",
    "should",
    "could",
    "would",
    "may",
    "might",
    "must",
    "about",
    "above",
    "across",
    "after",
    "against",
    "along",
    "among",
    "around",
    "at",
    "before",
    "doing",
    "behind",
    "below",
    "beside",
    "besides",
    "between",
    "beyond",
    "by",
    "down",
    "during",
    "except",
    "inside",
    "into",
    "like",
    "near",
    "next",
    "off",
    "onto",
    "also",
    "only",
    "out",
    "outside",
    "over",
    "past",
    "since",
    "through",
    "toward",
    "unlike",
    "up",
    "without",
    "me",
    "you",
    "she",
    "her",
    "mine",
    "your",
    "yours",
    "hers",
    "his",
    "its",
    "our",
    "ours",
    "their",
    "theirs",
    "my",
    "who",
    "whom",
    "whose",
    "which",
    "already",
    "all",
    "another",
    "any",
    "anybody",
    "anyone",
    "both",
    "each",
    "either",
    "everybody",
    "everyone",
    "everything",
    "few",
    "many",
    "neither",
    "nobody",
    "none",
    "no one",
    "nothing",
    "one",
    "some",
    "somebody",
    "someone",
    "something"
  ].map((item) => item.toLowerCase())
);

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function flexibleSearchTerm(value) {
  const map = {
    0: "o",
    1: "l",
    2: "z",
    3: "e",
    4: "a",
    5: "s",
    6: "g",
    7: "t",
    8: "b",
    9: "g",
    "@": "a",
    "!": "i"
  };
  return String(value || "")
    .split("")
    .map((char) => map[char] || char)
    .join("");
}

function escapeRegexForMysql(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function subsequenceRegexForWord(word) {
  const sanitized = String(word || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!sanitized) {
    return null;
  }
  const chars = sanitized.split("").map((char) => `[^a-z0-9]*${escapeRegexForMysql(char)}`);
  return `[^a-z0-9]*${chars.join("")}[^a-z0-9]*`;
}

function buildSearchContext(rawKeyword) {
  const normalized = normalizeSearchText(rawKeyword);
  const flexible = flexibleSearchTerm(normalized);
  const words = flexible.split(/\s+/).filter(Boolean);
  const filteredWords = words.filter((word) => !SEARCH_STOPWORDS.has(word));

  let filteredSearchQuery = (filteredWords.join(" ") || flexible || "").trim();
  if (filteredSearchQuery.length > 1 && filteredSearchQuery.endsWith("s")) {
    filteredSearchQuery = filteredSearchQuery.slice(0, -1);
  }

  const searchRegex = filteredWords.map(escapeRegexForMysql).join("|");

  const subsequenceRegexes = filteredWords
    .map((word) => subsequenceRegexForWord(word))
    .filter(Boolean);

  const oneCharWildcardPatterns = filteredWords
    .map((word) => {
      const cleanWord = String(word || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (cleanWord.length < 2) {
        return null;
      }
      const patterns = [];
      for (let i = 0; i < cleanWord.length; i += 1) {
        patterns.push(`${cleanWord.slice(0, i)}_${cleanWord.slice(i + 1)}`);
      }
      return patterns;
    })
    .filter(Boolean);

  return {
    normalized,
    flexible,
    filteredWords,
    filteredSearchQuery,
    searchRegex,
    subsequenceRegexes,
    oneCharWildcardPatterns
  };
}

router.get(
  "/category-clicks",
  requireAuth,
  requirePermission("category_clicks", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const country = String(req.query.country || "all_countries");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const { page, itemsPerPage, offset } = parsePagination(req.query, 100, 500);

    const filter = buildEventFilters({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      includeDeviceFilter: false
    });

    const [totalRows] = await pool.execute(
      `SELECT COUNT(DISTINCT category) AS total
       FROM ${TABLES.categoryClicks}
       WHERE ${filter.sql}`,
      filter.params
    );
    const totalItems = Number(totalRows[0]?.total || 0);

    const [rows] = await pool.execute(
      `SELECT category, COUNT(*) AS clicks
       FROM ${TABLES.categoryClicks}
       WHERE ${filter.sql}
       GROUP BY category
       ORDER BY clicks DESC
       LIMIT ?, ?`,
      [...filter.params, offset, itemsPerPage]
    );

    return res.json({
      data: rows.map((row) => ({
        category: row.category || "Unknown",
        clicks: Number(row.clicks || 0)
      })),
      currentPage: page,
      itemsPerPage,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage))
    });
  })
);

router.get(
  "/category-clicks/country-counts",
  requireAuth,
  requirePermission("category_clicks", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    const filter = buildEventFilters({
      option,
      startDate,
      endDate,
      country: "all_countries",
      dateColumn: "create_date",
      includeDeviceFilter: false
    });

    const [rows] = await pool.execute(
      `SELECT country, COUNT(*) AS cnt
       FROM ${TABLES.categoryClicks}
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
  "/search-keywords",
  requireAuth,
  requirePermission("search_keywords", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const country = String(req.query.country || "all_countries");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const keyword = String(req.query.keyword || "").trim();
    const { page, itemsPerPage, offset } = parsePagination(req.query, 100, 500);

    const date = buildDateSql(option, startDate, endDate, "search_date");
    const whereParts = [date.sql, "platform = 'android'"];
    const params = [...date.params];

    whereParts.push(`device_id NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`);
    params.push(...EXCLUDED_DEVICE_IDS);

    if (country !== "all_countries") {
      whereParts.push("country = ?");
      params.push(country);
    }
    if (keyword) {
      whereParts.push("search_keyword LIKE ?");
      params.push(`%${keyword}%`);
    }

    const whereSql = whereParts.join(" AND ");

    const [totalRows] = await pool.execute(
      `SELECT COUNT(DISTINCT search_keyword) AS total
       FROM ${TABLES.searchKeywords}
       WHERE ${whereSql}`,
      params
    );
    const totalItems = Number(totalRows[0]?.total || 0);
    const [sumRows] = await pool.execute(
      `SELECT COUNT(*) AS totalSearches
       FROM ${TABLES.searchKeywords}
       WHERE ${whereSql}`,
      params
    );
    const totalSearches = Number(sumRows[0]?.totalSearches || 0);

    const [rows] = await pool.execute(
      `SELECT search_keyword, COUNT(*) AS searches
       FROM ${TABLES.searchKeywords}
       WHERE ${whereSql}
       GROUP BY search_keyword
       ORDER BY searches DESC
       LIMIT ?, ?`,
      [...params, offset, itemsPerPage]
    );

    return res.json({
      data: rows.map((row) => ({
        keyword: row.search_keyword || "N/A",
        count: Number(row.searches || 0),
        search_keyword: row.search_keyword || "N/A",
        searches: Number(row.searches || 0)
      })),
      currentPage: page,
      itemsPerPage,
      totalItems,
      totalSearches,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage))
    });
  })
);

router.get(
  "/search-keywords/country-counts",
  requireAuth,
  requirePermission("search_keywords", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    const filter = buildEventFilters({
      option,
      startDate,
      endDate,
      country: "all_countries",
      dateColumn: "search_date",
      includeDeviceFilter: true
    });

    const [rows] = await pool.execute(
      `SELECT country, COUNT(*) AS cnt
       FROM ${TABLES.searchKeywords}
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
  "/search-keywords/country-breakdown",
  requireAuth,
  requirePermission("search_keywords", "view"),
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.keyword || "").trim();
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    if (!keyword) {
      return res.status(400).json({ error: "keyword is required" });
    }

    const date = buildDateSql(option, startDate, endDate, "s.search_date");
    const whereParts = [
      date.sql,
      "s.platform = 'android'",
      `s.device_id NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`,
      "LOWER(TRIM(s.search_keyword)) = LOWER(?)"
    ];
    const params = [...date.params, ...EXCLUDED_DEVICE_IDS, keyword];

    const [rows] = await pool.execute(
      `SELECT
          COALESCE(NULLIF(TRIM(s.country), ''), 'Unknown') AS country,
          COUNT(*) AS count
       FROM ${TABLES.searchKeywords} s
       WHERE ${whereParts.join(" AND ")}
       GROUP BY country
       ORDER BY count DESC`,
      params
    );

    const countries = rows.map((row) => ({
      country: row.country || "Unknown",
      count: Number(row.count || 0)
    }));
    const total = countries.reduce((sum, row) => sum + Number(row.count || 0), 0);

    return res.json({ total, countries });
  })
);

router.get(
  "/search-keywords/related-mods",
  requireAuth,
  requirePermission("search_keywords", "view"),
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.keyword || "").trim();
    const option = String(req.query.option || "last_30_days");
    const country = String(req.query.country || "all_countries");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const platform = String(req.query.platform || "android").toLowerCase();
    const version = String(req.query.version || "").trim();

    const fromRaw = Number(req.query.from ?? req.query.offset ?? 0);
    const sizeRaw = Number(req.query.to ?? req.query.limit ?? 30);
    const offset = Number.isFinite(fromRaw) && fromRaw > 0 ? Math.floor(fromRaw) : 0;
    const limit = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(Math.floor(sizeRaw), 100) : 30;

    if (!keyword) {
      return res.json({ data: [], offset, limit, hasMore: false });
    }

    const searchContext = buildSearchContext(keyword);
    if (!searchContext.filteredSearchQuery) {
      return res.json({ data: [], offset, limit, hasMore: false });
    }

    const activeColumn = platform === "ios" ? "isActive" : "android_isActive";
    const versionColumn = platform === "ios" ? "ios_version" : "android_version";

    const filteredQueryLike = `%${escapeLikeValue(searchContext.filteredSearchQuery)}%`;
    const whereBase = [`m.${activeColumn} = 1`];
    const whereBaseParams = [];
    if (version) {
      whereBase.push(`m.${versionColumn} LIKE ?`);
      whereBaseParams.push(`%${escapeLikeValue(version)}%`);
    }

    const searchConditions = [];
    const searchParams = [];

    searchConditions.push("LOWER(m.name) LIKE ?");
    searchParams.push(filteredQueryLike);

    if (searchContext.searchRegex) {
      const boundaryRegex = `(^| )(${searchContext.searchRegex})( |$)`;
      searchConditions.push("LOWER(m.name) REGEXP ?");
      searchParams.push(boundaryRegex);
    }

    searchConditions.push("LOWER(m.description) LIKE ?");
    searchParams.push(filteredQueryLike);

    if (searchContext.searchRegex) {
      const boundaryRegex = `(^| )(${searchContext.searchRegex})( |$)`;
      searchConditions.push("LOWER(m.description) REGEXP ?");
      searchParams.push(boundaryRegex);
    }

    if (searchContext.subsequenceRegexes.length > 0) {
      const fuzzyConditions = [];
      searchContext.subsequenceRegexes.forEach((regexPattern) => {
        fuzzyConditions.push("(LOWER(m.name) REGEXP ? OR LOWER(m.description) REGEXP ?)");
        searchParams.push(regexPattern, regexPattern);
      });
      searchConditions.push(`(${fuzzyConditions.join(" AND ")})`);
    }

    if (searchContext.oneCharWildcardPatterns.length > 0) {
      const wordGroups = [];
      searchContext.oneCharWildcardPatterns.forEach((patterns) => {
        const oneWordPattern = [];
        patterns.forEach((pattern) => {
          const likePattern = `%${escapeLikeValue(pattern)}%`;
          oneWordPattern.push("LOWER(m.name) LIKE ?");
          searchParams.push(likePattern);
          oneWordPattern.push("LOWER(m.description) LIKE ?");
          searchParams.push(likePattern);
        });
        wordGroups.push(`(${oneWordPattern.join(" OR ")})`);
      });
      searchConditions.push(`(${wordGroups.join(" AND ")})`);
    }

    const rankCaseOne = `
      CASE
        WHEN LOWER(m.name) = ? THEN 1
        WHEN LOWER(m.name) LIKE ? THEN 2
        WHEN LOWER(m.name) LIKE ? THEN 3
        ELSE 4
      END
    `;
    const rankOneParams = [
      searchContext.filteredSearchQuery,
      `${escapeLikeValue(searchContext.filteredSearchQuery)} %`,
      filteredQueryLike
    ];

    const rankCaseTwo = searchContext.searchRegex
      ? `
      CASE
        WHEN LOWER(m.name) REGEXP ? THEN 5
        WHEN LOWER(m.name) REGEXP ? THEN 6
        WHEN LOWER(m.name) REGEXP ? THEN 7
        ELSE 8
      END
    `
      : "8";
    const rankTwoParams = searchContext.searchRegex
      ? [
          `^(${searchContext.searchRegex})`,
          `(${searchContext.searchRegex})$`,
          `(^| )(${searchContext.searchRegex})( |$)`
        ]
      : [];

    const downloadFilter = buildEventFilters({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      includeDeviceFilter: true,
      tableAlias: "d"
    });
    const impressionFilter = buildEventFilters({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      includeDeviceFilter: true,
      tableAlias: "i"
    });

    const [rows] = await pool.execute(
      `SELECT
          m.post_id AS id,
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', m.post_id)) AS name,
          m.category,
          m.sub_category AS subCategory,
          m.title_for_path AS title_for_path,
          m.file_format AS file_formate,
          m.thumb_image AS displayImage,
          m.sub_images AS subImages,
          m.coins AS price,
          COALESCE(d_stats.cnt, 0) AS periodDownloads,
          COALESCE(i_stats.cnt, 0) AS periodImpressions,
          COALESCE(m.android_download, m.download, 0) AS totalDownloads
       FROM ${TABLES.mods} m
       LEFT JOIN (
         SELECT d.post_id, COUNT(*) AS cnt
         FROM ${TABLES.downloads} d
         WHERE ${downloadFilter.sql}
         GROUP BY d.post_id
       ) d_stats ON d_stats.post_id = m.post_id
       LEFT JOIN (
         SELECT i.post_id, COUNT(*) AS cnt
         FROM ${TABLES.impressions} i
         WHERE ${impressionFilter.sql}
         GROUP BY i.post_id
       ) i_stats ON i_stats.post_id = m.post_id
       WHERE ${whereBase.join(" AND ")}
         AND (${searchConditions.join(" OR ")})
       ORDER BY
         ${rankCaseOne},
         ${rankCaseTwo},
         LENGTH(m.name) ASC,
         m.name ASC,
         periodDownloads DESC,
         totalDownloads DESC
       LIMIT ?, ?`,
      [
        ...downloadFilter.params,
        ...impressionFilter.params,
        ...whereBaseParams,
        ...searchParams,
        ...rankOneParams,
        ...rankTwoParams,
        offset,
        limit
      ]
    );

    const data = rows.map((row) => ({
      id: Number(row.id),
      name: row.name || "Mod",
      displayName: row.name || "Mod",
      category: row.category || "",
      subCategory: row.subCategory || "",
      title_for_path: row.title_for_path || "",
      file_formate: row.file_formate || row.subCategory || "",
      displayImage: row.displayImage || "None",
      subImages: row.subImages || "None",
      price: Number(row.price || 0),
      downloads: Number(row.periodDownloads || 0),
      impressions: Number(row.periodImpressions || 0),
      totalDownloads: Number(row.totalDownloads || 0)
    }));

    return res.json({
      data,
      offset,
      limit,
      hasMore: data.length === limit
    });
  })
);

router.get(
  "/mod-analysis/country-counts",
  requireAuth,
  requirePermission("mod_analysis", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const category = String(req.query.category || "");
    const subCategory = String(req.query.subCategory || "");
    const priceType = String(req.query.priceType || "all");

    const date = buildDateSql(option, startDate, endDate, "i.create_date");
    const whereParts = [
      date.sql,
      "i.platform = 'android'",
      `i.device_id NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`,
      "i.country IS NOT NULL",
      "i.country <> ''"
    ];
    const params = [...date.params, ...EXCLUDED_DEVICE_IDS];

    if (category && category !== "all") {
      whereParts.push("m.category = ?");
      params.push(category);
    }
    if (subCategory && subCategory !== "all") {
      whereParts.push("m.sub_category = ?");
      params.push(subCategory);
    }
    if (priceType === "free") {
      whereParts.push("(m.coins = 0 OR m.coins IS NULL)");
    } else if (priceType === "premium") {
      whereParts.push("m.coins > 0");
    }

    const [rows] = await pool.execute(
      `SELECT i.country, COUNT(*) AS cnt
       FROM ${TABLES.impressions} i
       INNER JOIN ${TABLES.mods} m ON m.post_id = i.post_id
       WHERE ${whereParts.join(" AND ")}
       GROUP BY i.country
       ORDER BY cnt DESC`,
      params
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
  "/mod-analysis",
  requireAuth,
  requirePermission("mod_analysis", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const country = String(req.query.country || "all_countries");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const sortBy = String(req.query.sortBy || "impressions");
    const category = String(req.query.category || "");
    const subCategory = String(req.query.subCategory || "");
    const priceType = String(req.query.priceType || "all");
    const { page, itemsPerPage, offset } = parsePagination(req.query, 150, 500);

    const impressionFilter = buildEventFilters({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      includeDeviceFilter: true
    });
    const clickFilter = buildEventFilters({
      option,
      startDate,
      endDate,
      country,
      dateColumn: "create_date",
      includeDeviceFilter: true
    });

    const modWhere = ["(COALESCE(i.cnt, 0) > 0 OR COALESCE(c.cnt, 0) > 0)"];
    const modParams = [];

    if (category && category !== "all") {
      modWhere.push("m.category = ?");
      modParams.push(category);
    }
    if (subCategory && subCategory !== "all") {
      modWhere.push("m.sub_category = ?");
      modParams.push(subCategory);
    }
    if (priceType === "free") {
      modWhere.push("(m.coins = 0 OR m.coins IS NULL)");
    } else if (priceType === "premium") {
      modWhere.push("m.coins > 0");
    }
    modWhere.push("m.android_isActive = 1");

    const orderSql =
      sortBy === "downloads"
        ? "downloads DESC, impressions DESC"
        : sortBy === "conversion"
        ? "conversion_pct DESC, impressions DESC"
        : "impressions DESC, downloads DESC";

    const baseQuery = `
      FROM ${TABLES.mods} m
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt
        FROM ${TABLES.impressions}
        WHERE ${impressionFilter.sql}
        GROUP BY post_id
      ) i ON i.post_id = m.post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt
        FROM ${TABLES.downloads}
        WHERE ${clickFilter.sql}
        GROUP BY post_id
      ) c ON c.post_id = m.post_id
      WHERE ${modWhere.join(" AND ")}
    `;

    const totalParams = [...impressionFilter.params, ...clickFilter.params, ...modParams];
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      totalParams
    );
    const totalItems = Number(totalRows[0]?.total || 0);

    const [aggregateRows] = await pool.execute(
      `SELECT
          COALESCE(SUM(COALESCE(i.cnt, 0)), 0) AS total_impressions,
          COALESCE(SUM(COALESCE(c.cnt, 0)), 0) AS total_downloads
       ${baseQuery}`,
      totalParams
    );
    const totalImpressionsAll = Number(aggregateRows[0]?.total_impressions || 0);
    const totalDownloadsAll = Number(aggregateRows[0]?.total_downloads || 0);
    const overallConversion =
      totalImpressionsAll > 0 ? (100 * totalDownloadsAll) / totalImpressionsAll : 0;

    const [rows] = await pool.execute(
      `SELECT
          m.post_id AS mod_id,
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', m.post_id)) AS mod_name,
          m.coins AS price,
          m.category AS category,
          m.sub_category AS subCategory,
          m.title_for_path AS title_for_path,
          m.thumb_image AS displayImage,
          m.sub_images AS subImages,
          m.file_format AS file_formate,
          COALESCE(i.cnt, 0) AS impressions,
          COALESCE(c.cnt, 0) AS downloads,
          ROUND(100 * COALESCE(c.cnt, 0) / NULLIF(COALESCE(i.cnt, 0), 0), 2) AS conversion_pct
       ${baseQuery}
       ORDER BY ${orderSql}
       LIMIT ?, ?`,
      [...totalParams, offset, itemsPerPage]
    );

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalImpressions += Number(row.impressions || 0);
        acc.totalDownloads += Number(row.downloads || 0);
        return acc;
      },
      { totalImpressions: 0, totalDownloads: 0 }
    );

    const labels = rows.slice(0, 20).map((row) => row.mod_name || "Mod");
    const impressionsChart = rows.slice(0, 20).map((row) => Number(row.impressions || 0));
    const clicksChart = rows.slice(0, 20).map((row) => Number(row.downloads || 0));
    const conversionChart = rows
      .slice(0, 20)
      .map((row) => Number(row.conversion_pct || 0));

    return res.json({
      labels,
      impressions: impressionsChart,
      clicks: clicksChart,
      conversion: conversionChart,
      mods: rows.map((row) => ({
        mod_id: Number(row.mod_id),
        mod_name: row.mod_name,
        displayName: row.mod_name,
        price: row.price === null ? null : Number(row.price),
        category: row.category,
        subCategory: row.subCategory,
        file_formate: row.file_formate,
        title_for_path: row.title_for_path,
        displayImage: row.displayImage,
        subImages: row.subImages,
        impressions: Number(row.impressions || 0),
        downloads: Number(row.downloads || 0),
        conversion_pct: Number(row.conversion_pct || 0)
      })),
      totals: {
        ...totals,
        totalImpressions: totalImpressionsAll,
        totalDownloads: totalDownloadsAll,
        overallConversion,
        totalMods: totalItems
      },
      totalImpressions: totalImpressionsAll,
      totalDownloads: totalDownloadsAll,
      overallConversion,
      totalMods: totalItems,
      currentPage: page,
      itemsPerPage,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage)),
      pagination: {
        currentPage: page,
        itemsPerPage,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage))
      }
    });
  })
);

router.get(
  "/mods/:id/country-breakdown",
  requireAuth,
  requirePermission("mod_analysis", "view"),
  asyncHandler(async (req, res) => {
    const modId = Number(req.params.id);
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");

    if (!Number.isInteger(modId) || modId <= 0) {
      return res.status(400).json({ error: "Invalid mod id" });
    }

    const date = buildDateSql(option, startDate, endDate, "create_date");
    const deviceSql = `device_id NOT IN ${toMysqlInPlaceholders(EXCLUDED_DEVICE_IDS)}`;
    const where = `post_id = ? AND platform = 'android' AND ${deviceSql} AND ${date.sql}`;
    const params = [modId, ...EXCLUDED_DEVICE_IDS, ...date.params];

    const [impressions] = await pool.execute(
      `SELECT country, COUNT(*) AS count
       FROM ${TABLES.impressions}
       WHERE ${where}
       GROUP BY country
       ORDER BY count DESC`,
      params
    );

    const [clicks] = await pool.execute(
      `SELECT country, COUNT(*) AS count
       FROM ${TABLES.downloads}
       WHERE ${where}
       GROUP BY country
       ORDER BY count DESC`,
      params
    );

    return res.json({ impressions, clicks });
  })
);

router.get(
  "/price-history-period",
  requireAuth,
  requirePermission("mod_change_history", "view"),
  asyncHandler(async (req, res) => {
    const modId = Number(req.query.modId || 0);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    if (!Number.isInteger(modId) || modId <= 0 || !from || !to) {
      return res.status(400).json({ error: "modId, from, and to are required" });
    }

    const parsedFrom = parseDateTimeInput(from, "00:00:00");
    const parsedTo = parseDateTimeInput(to, "00:00:00");

    if (!parsedFrom.valid || !parsedTo.valid) {
      return res
        .status(400)
        .json({ error: "from and to must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS" });
    }

    const toSql = parsedTo.isDateOnly ? "DATE_ADD(?, INTERVAL 1 DAY)" : "?";
    const toParams = parsedTo.isDateOnly ? [parsedTo.dateOnly] : [parsedTo.value];
    const rangeParams = [modId, parsedFrom.value, ...toParams];

    const [dailyImpressions] = await pool.execute(
      `SELECT DATE(create_date) AS d, COUNT(*) AS cnt
       FROM ${TABLES.impressions}
       WHERE post_id = ? AND platform = 'android' AND create_date >= ? AND create_date < ${toSql}
       GROUP BY DATE(create_date)
       ORDER BY d`,
      rangeParams
    );
    const [dailyClicks] = await pool.execute(
      `SELECT DATE(create_date) AS d, COUNT(*) AS cnt
       FROM ${TABLES.downloads}
       WHERE post_id = ? AND platform = 'android' AND create_date >= ? AND create_date < ${toSql}
       GROUP BY DATE(create_date)
       ORDER BY d`,
      rangeParams
    );

    const dailyByDate = new Map();
    dailyImpressions.forEach((row) => {
      const key = String(row.d || "").slice(0, 10);
      if (!key) return;
      dailyByDate.set(key, {
        date: key,
        impressions: Number(row.cnt || 0),
        downloads: Number(dailyByDate.get(key)?.downloads || 0)
      });
    });
    dailyClicks.forEach((row) => {
      const key = String(row.d || "").slice(0, 10);
      if (!key) return;
      const previous = dailyByDate.get(key) || { date: key, impressions: 0, downloads: 0 };
      dailyByDate.set(key, {
        date: key,
        impressions: Number(previous.impressions || 0),
        downloads: Number(row.cnt || 0)
      });
    });
    const daily = Array.from(dailyByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    const [countryImpressions] = await pool.execute(
      `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country, COUNT(*) AS cnt
       FROM ${TABLES.impressions}
       WHERE post_id = ? AND platform = 'android' AND create_date >= ? AND create_date < ${toSql}
       GROUP BY country`,
      rangeParams
    );
    const [countryClicks] = await pool.execute(
      `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country, COUNT(*) AS cnt
       FROM ${TABLES.downloads}
       WHERE post_id = ? AND platform = 'android' AND create_date >= ? AND create_date < ${toSql}
       GROUP BY country`,
      rangeParams
    );

    const byCountry = new Map();
    countryImpressions.forEach((row) => {
      const country = String(row.country || "Unknown");
      byCountry.set(country, {
        country,
        impressions: Number(row.cnt || 0),
        downloads: Number(byCountry.get(country)?.downloads || 0)
      });
    });
    countryClicks.forEach((row) => {
      const country = String(row.country || "Unknown");
      const previous = byCountry.get(country) || { country, impressions: 0, downloads: 0 };
      byCountry.set(country, {
        country,
        impressions: Number(previous.impressions || 0),
        downloads: Number(row.cnt || 0)
      });
    });

    const topCountries = Array.from(byCountry.values())
      .sort(
        (a, b) =>
          Number(b.impressions || 0) +
          Number(b.downloads || 0) -
          (Number(a.impressions || 0) + Number(a.downloads || 0))
      )
      .slice(0, 10);

    return res.json({
      ok: true,
      modId,
      from: parsedFrom.value,
      to: parsedTo.isDateOnly ? parsedTo.dateOnly : parsedTo.value,
      daily,
      dailyImpressions,
      dailyClicks,
      topCountries,
      top_countries: topCountries
    });
  })
);

router.get(
  "/mods/:id/period",
  requireAuth,
  requirePermission("mod_analysis", "view"),
  asyncHandler(async (req, res) => {
    const modId = Number(req.params.id);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    if (!Number.isInteger(modId) || modId <= 0 || !from || !to) {
      return res.status(400).json({ error: "mod id, from, and to are required" });
    }

    const [dailyImpressions] = await pool.execute(
      `SELECT DATE(create_date) AS d, COUNT(*) AS cnt
       FROM ${TABLES.impressions}
       WHERE post_id = ? AND platform = 'android' AND DATE(create_date) BETWEEN ? AND ?
       GROUP BY DATE(create_date)
       ORDER BY d`,
      [modId, from, to]
    );
    const [dailyClicks] = await pool.execute(
      `SELECT DATE(create_date) AS d, COUNT(*) AS cnt
       FROM ${TABLES.downloads}
       WHERE post_id = ? AND platform = 'android' AND DATE(create_date) BETWEEN ? AND ?
       GROUP BY DATE(create_date)
       ORDER BY d`,
      [modId, from, to]
    );

    return res.json({ dailyImpressions, dailyClicks });
  })
);

router.get(
  "/price-history-compare",
  requireAuth,
  requirePermission("mod_change_history", "view"),
  asyncHandler(async (req, res) => {
    const modId = Number(req.query.modId || 0);
    const option = String(req.query.option || "all_time");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const schema = await getPriceHistorySchema();

    if (!Number.isInteger(modId) || modId <= 0) {
      return res.status(400).json({ error: "Invalid modId" });
    }
    if (!schema.beforeColumn || !schema.afterColumn || !schema.changedAtColumn) {
      return res.status(500).json({ error: "Price history columns are not compatible" });
    }

    const dateFilter = buildHistoryDateSql(
      option,
      startDate,
      endDate,
      `h.${schema.changedAtColumn}`
    );
    const whereParts = [dateFilter.sql, "h.mod_id = ?"];
    const whereParams = [...dateFilter.params, modId];

    const downloadsSelect = schema.downloadsColumn
      ? `h.${schema.downloadsColumn} AS downloads_at_change`
      : "NULL AS downloads_at_change";
    const impressionsSelect = schema.impressionsColumn
      ? `h.${schema.impressionsColumn} AS impressions_at_change`
      : "NULL AS impressions_at_change";
    const fieldSelect = schema.fieldColumn ? `h.${schema.fieldColumn} AS field` : `'price' AS field`;

    const [historyRows] = await pool.execute(
      `SELECT
          h.id,
          h.mod_id,
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', h.mod_id)) AS mod_name,
          ${fieldSelect},
          h.${schema.beforeColumn} AS value_before,
          h.${schema.afterColumn} AS value_after,
          h.${schema.changedAtColumn} AS changed_at,
          ${downloadsSelect},
          ${impressionsSelect}
       FROM addon_android_mod_price_history h
       LEFT JOIN ${TABLES.mods} m ON m.post_id = h.mod_id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY h.${schema.changedAtColumn} DESC, h.id DESC
       LIMIT 1500`,
      whereParams
    );

    if (!historyRows.length) {
      return res.json({
        data: [],
        modId,
        option,
        startDate,
        endDate,
        totalItems: 0
      });
    }

    const groupedByChangeTime = new Map();
    historyRows.forEach((row) => {
      const changedAt = String(row.changed_at || "");
      const key = `${row.mod_id}|${changedAt}`;
      if (!groupedByChangeTime.has(key)) {
        groupedByChangeTime.set(key, {
          id: row.id,
          mod_id: row.mod_id,
          mod_name: row.mod_name,
          changed_at: row.changed_at,
          downloads_at_change: row.downloads_at_change,
          impressions_at_change: row.impressions_at_change,
          changes: []
        });
      }
      groupedByChangeTime.get(key).changes.push({
        field: String(row.field || "field"),
        before: row.value_before,
        after: row.value_after
      });
    });
    const groupedRows = Array.from(groupedByChangeTime.values()).slice(0, 500);

    return res.json({
      data: groupedRows,
      modId,
      option,
      startDate,
      endDate,
      totalItems: groupedRows.length
    });
  })
);

router.get(
  "/mod-change-history",
  requireAuth,
  requirePermission("mod_change_history", "view"),
  asyncHandler(async (req, res) => {
    const option = String(req.query.option || "last_30_days");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const modId = Number(req.query.modId || 0);
    const hasModIdFilter = Number.isInteger(modId) && modId > 0;

    const schema = await getPriceHistorySchema();
    if (!schema.changedAtColumn) {
      return res.status(500).json({ error: "History changed time column is not compatible" });
    }

    const dateFilter = buildHistoryDateSql(
      option,
      startDate,
      endDate,
      `h.${schema.changedAtColumn}`
    );
    const whereParts = [dateFilter.sql];
    const params = [...dateFilter.params];

    if (hasModIdFilter) {
      whereParts.push("h.mod_id = ?");
      params.push(modId);
    }

    const [rows] = await pool.execute(
      `SELECT
          h.mod_id,
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', h.mod_id)) AS mod_name,
          MIN(h.${schema.changedAtColumn}) AS first_changed_at,
          MAX(h.${schema.changedAtColumn}) AS last_changed_at,
          COUNT(*) AS changes_count
       FROM addon_android_mod_price_history h
       JOIN ${TABLES.mods} m ON m.post_id = h.mod_id
       WHERE ${whereParts.join(" AND ")}
       GROUP BY h.mod_id, m.name
       ORDER BY last_changed_at DESC
       LIMIT 500`,
      params
    );

    return res.json({
      data: rows.map((row) => ({
        mod_id: Number(row.mod_id),
        mod_name: row.mod_name || "",
        displayName: row.mod_name || "",
        first_changed_at: row.first_changed_at,
        last_changed_at: row.last_changed_at,
        changes_count: Number(row.changes_count || 0)
      })),
      option,
      startDate,
      endDate,
      modId: hasModIdFilter ? modId : null
    });
  })
);

router.get(
  "/price-history",
  requireAuth,
  requirePermission("mod_change_history", "view"),
  asyncHandler(async (req, res) => {
    const { page, itemsPerPage, offset } = parsePagination(req.query, 30, 200);
    const modId = Number(req.query.modId || 0);
    const hasModIdFilter = Number.isInteger(modId) && modId > 0;
    const option = String(req.query.option || "all_time");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const schema = await getPriceHistorySchema();

    if (!schema.beforeColumn || !schema.afterColumn) {
      return res.status(500).json({ error: "Price history columns are not compatible" });
    }

    const dateFilter = schema.changedAtColumn
      ? buildHistoryDateSql(option, startDate, endDate, `h.${schema.changedAtColumn}`)
      : { sql: "1=1", params: [] };
    const whereParts = [];
    const whereParams = [...dateFilter.params];
    whereParts.push(dateFilter.sql);
    if (schema.fieldColumn) {
      whereParts.push(`h.${schema.fieldColumn} = 'price'`);
    }
    if (hasModIdFilter) {
      whereParts.push("h.mod_id = ?");
      whereParams.push(modId);
    }

    const wherePriceSqlWithAlias =
      whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
    const changedAtOrderColumn = schema.changedAtColumn ? `h.${schema.changedAtColumn}` : "h.id";
    const changedAtSelect = schema.changedAtColumn
      ? `h.${schema.changedAtColumn} AS changed_at`
      : "NULL AS changed_at";
    const downloadsSelect = schema.downloadsColumn
      ? `h.${schema.downloadsColumn} AS downloads_at_change`
      : "NULL AS downloads_at_change";
    const impressionsSelect = schema.impressionsColumn
      ? `h.${schema.impressionsColumn} AS impressions_at_change`
      : "NULL AS impressions_at_change";

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM addon_android_mod_price_history h
       ${wherePriceSqlWithAlias}`,
      whereParams
    );
    const totalItems = Number(totalRows[0]?.total || 0);

    const [rows] = await pool.execute(
      `SELECT
          h.id,
          h.mod_id,
          COALESCE(NULLIF(TRIM(m.name), ''), CONCAT('Mod ', h.mod_id)) AS mod_name,
          h.${schema.beforeColumn} AS price_before,
          h.${schema.afterColumn} AS price_after,
          ${changedAtSelect},
          ${downloadsSelect},
          ${impressionsSelect}
       FROM addon_android_mod_price_history h
       LEFT JOIN ${TABLES.mods} m ON m.post_id = h.mod_id
       ${wherePriceSqlWithAlias}
       ORDER BY ${changedAtOrderColumn} DESC
       LIMIT ?, ?`,
      [...whereParams, offset, itemsPerPage]
    );

    return res.json({
      data: rows,
      currentPage: page,
      itemsPerPage,
      option,
      startDate,
      endDate,
      modId: hasModIdFilter ? modId : null,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage))
    });
  })
);

export default router;
