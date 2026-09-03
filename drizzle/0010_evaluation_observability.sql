ALTER TABLE `evaluation_runs` ADD COLUMN `dataset_version` text;
ALTER TABLE `evaluation_runs` ADD COLUMN `prompt_version` text;
ALTER TABLE `evaluation_runs` ADD COLUMN `duration_ms` integer;
ALTER TABLE `evaluation_runs` ADD COLUMN `total_tokens` integer;
ALTER TABLE `evaluation_results` ADD COLUMN `duration_ms` integer;
ALTER TABLE `evaluation_results` ADD COLUMN `prompt_tokens` integer;
ALTER TABLE `evaluation_results` ADD COLUMN `completion_tokens` integer;
ALTER TABLE `evaluation_results` ADD COLUMN `total_tokens` integer;
