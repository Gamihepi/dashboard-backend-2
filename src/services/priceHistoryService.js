import { pool } from "../db/pool.js";

let schemaCache = null;
const HISTORY_TABLE = "addon_android_mod_price_history";

function pickFirstMatch(columnSet, names) {
  for (const name of names) {
    if (columnSet.has(name)) {
      return name;
    }
  }
  return null;
}

export async function getPriceHistorySchema() {
  if (schemaCache) {
    return schemaCache;
  }

  const [columns] = await pool.execute(`SHOW COLUMNS FROM ${HISTORY_TABLE}`);
  const columnSet = new Set(
    columns.map((column) => String(column.Field || "").trim().toLowerCase())
  );

  schemaCache = {
    beforeColumn: pickFirstMatch(columnSet, ["value_before", "price_before"]),
    afterColumn: pickFirstMatch(columnSet, ["value_after", "price_after"]),
    changedAtColumn: pickFirstMatch(columnSet, ["changed_at", "timestamp"]),
    changedByColumn: pickFirstMatch(columnSet, ["changed_by", "changed_by_user_id"]),
    downloadsColumn: pickFirstMatch(columnSet, ["downloads_at_change"]),
    impressionsColumn: pickFirstMatch(columnSet, ["impressions_at_change"]),
    fieldColumn: pickFirstMatch(columnSet, ["field"])
  };

  return schemaCache;
}

function toHistoryValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

export async function insertModFieldHistory({
  modId,
  field,
  beforeValue,
  afterValue,
  changedBy,
  downloadsAtChange,
  impressionsAtChange,
  changedAt
}) {
  const schema = await getPriceHistorySchema();

  if (!schema.beforeColumn || !schema.afterColumn) {
    return false;
  }

  const columns = ["mod_id"];
  const valuesSql = ["?"];
  const params = [modId];

  if (schema.fieldColumn) {
    columns.push(schema.fieldColumn);
    valuesSql.push("?");
    params.push(String(field || ""));
  }

  columns.push(schema.beforeColumn);
  valuesSql.push("?");
  params.push(toHistoryValue(beforeValue));

  columns.push(schema.afterColumn);
  valuesSql.push("?");
  params.push(toHistoryValue(afterValue));

  if (schema.changedAtColumn) {
    columns.push(schema.changedAtColumn);
    valuesSql.push("?");
    params.push(changedAt || new Date());
  }

  if (schema.changedByColumn) {
    columns.push(schema.changedByColumn);
    valuesSql.push("?");
    params.push(changedBy ?? null);
  }

  if (schema.downloadsColumn) {
    columns.push(schema.downloadsColumn);
    valuesSql.push("?");
    params.push(downloadsAtChange ?? null);
  }

  if (schema.impressionsColumn) {
    columns.push(schema.impressionsColumn);
    valuesSql.push("?");
    params.push(impressionsAtChange ?? null);
  }

  await pool.execute(
    `INSERT INTO ${HISTORY_TABLE} (${columns.join(", ")})
     VALUES (${valuesSql.join(", ")})`,
    params
  );

  return true;
}

export async function insertPriceHistory({
  modId,
  beforePrice,
  afterPrice,
  changedBy,
  downloadsAtChange,
  impressionsAtChange,
  changedAt
}) {
  return insertModFieldHistory({
    modId,
    field: "price",
    beforeValue: beforePrice,
    afterValue: afterPrice,
    changedBy,
    downloadsAtChange,
    impressionsAtChange,
    changedAt
  });
}
