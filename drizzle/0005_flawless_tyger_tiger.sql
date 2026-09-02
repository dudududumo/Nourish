-- Compatibility marker only. These columns were already introduced by
-- 0003_glossy_fasting_pro.sql and 0004_calm_fasting_experience.sql.
-- Keeping this migration as a no-op preserves the published migration order
-- without attempting duplicate ALTER TABLE operations on existing databases.
SELECT 1;
