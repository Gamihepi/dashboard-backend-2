-- Migration: make addon_android_mod_price_history store all changed fields
-- Safe to run multiple times.

SET @db_name = DATABASE();
SET @table_name = 'addon_android_mod_price_history';

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'field') = 0,
  'ALTER TABLE addon_android_mod_price_history ADD COLUMN `field` varchar(100) NOT NULL DEFAULT ''price'' AFTER mod_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'value_before') = 0,
  'ALTER TABLE addon_android_mod_price_history ADD COLUMN `value_before` text NULL AFTER `field`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'value_after') = 0,
  'ALTER TABLE addon_android_mod_price_history ADD COLUMN `value_after` text NULL AFTER `value_before`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill generic columns from old price columns when present.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'price_before') > 0
  AND
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = @table_name AND COLUMN_NAME = 'price_after') > 0,
  'UPDATE addon_android_mod_price_history
   SET `field` = COALESCE(NULLIF(`field`, ''''), ''price''),
       `value_before` = COALESCE(`value_before`, CAST(`price_before` AS CHAR)),
       `value_after` = COALESCE(`value_after`, CAST(`price_after` AS CHAR))
   WHERE (`value_before` IS NULL OR `value_before` = '''')
      OR (`value_after` IS NULL OR `value_after` = '''')',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Optional: keep old columns for compatibility; do not drop here.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @db_name
     AND TABLE_NAME = @table_name
     AND INDEX_NAME = 'idx_mod_field_changed') = 0,
  'CREATE INDEX idx_mod_field_changed ON addon_android_mod_price_history (mod_id, field, changed_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
