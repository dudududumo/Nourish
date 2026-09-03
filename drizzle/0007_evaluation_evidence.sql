CREATE TABLE IF NOT EXISTS `evaluation_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `model` text NOT NULL,
  `scope` text NOT NULL,
  `total` integer NOT NULL,
  `passed` integer NOT NULL,
  `pass_rate` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluation_runs_user_date` ON `evaluation_runs` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluation_results` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` text NOT NULL,
  `case_id` text NOT NULL,
  `category` text NOT NULL,
  `severity` text NOT NULL,
  `passed` integer NOT NULL,
  `answer` text DEFAULT '' NOT NULL,
  `required_hits_json` text DEFAULT '[]' NOT NULL,
  `forbidden_hits_json` text DEFAULT '[]' NOT NULL,
  `error` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluation_results_run` ON `evaluation_results` (`run_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluation_results_case` ON `evaluation_results` (`case_id`);
