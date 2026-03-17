function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildDateSql(option, startDate, endDate, column = "timestamp") {
  switch (option) {
    case "today":
      return { sql: `DATE(${column}) = CURDATE()`, params: [] };
    case "yesterday":
      return { sql: `DATE(${column}) = CURDATE() - INTERVAL 1 DAY`, params: [] };
    case "last_7_days":
      return {
        sql: `DATE(${column}) BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE()`,
        params: []
      };
    case "last_30_days":
      return {
        sql: `DATE(${column}) BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()`,
        params: []
      };
    case "last_90_days":
      return {
        sql: `DATE(${column}) BETWEEN CURDATE() - INTERVAL 90 DAY AND CURDATE()`,
        params: []
      };
    case "custom":
      if (isValidDate(startDate) && isValidDate(endDate)) {
        return { sql: `DATE(${column}) BETWEEN ? AND ?`, params: [startDate, endDate] };
      }
      return { sql: "1=1", params: [] };
    default:
      return { sql: "1=1", params: [] };
  }
}

export function parsePagination(query, defaultPageSize = 40, maxPageSize = 200) {
  const page = Number(query.page || 1);
  const itemsPerPage = Number(query.itemsPerPage || defaultPageSize);

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeItems =
    Number.isFinite(itemsPerPage) && itemsPerPage > 0
      ? Math.min(Math.floor(itemsPerPage), maxPageSize)
      : defaultPageSize;

  return {
    page: safePage,
    itemsPerPage: safeItems,
    offset: (safePage - 1) * safeItems
  };
}

export function toMysqlInPlaceholders(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return "(NULL)";
  }
  return `(${values.map(() => "?").join(",")})`;
}

