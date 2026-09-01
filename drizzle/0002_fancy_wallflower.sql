CREATE TABLE `fasting_settings` (
        `user_id` text PRIMARY KEY NOT NULL,
        `enabled` integer DEFAULT 0 NOT NULL,
        `plan_hours` integer DEFAULT 16 NOT NULL,
        `start_at` text,
        `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fasting_logs` (
        `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        `user_id` text NOT NULL,
        `date` text NOT NULL,
        `fast_hours` real DEFAULT 0 NOT NULL,
        `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fasting_logs_user_date` ON `fasting_logs` (`user_id`,`date`);