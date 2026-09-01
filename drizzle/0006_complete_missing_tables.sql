CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`password_hash` text NOT NULL,
	`nickname` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_sessions_token` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `weekly_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`week_end` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`goal` text,
	`target_calories` real,
	`target_protein` real,
	`rationale` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_weekly_plans_user_week` ON `weekly_plans` (`user_id`,`week_start`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `daily_meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`meal_type` text NOT NULL,
	`dish_name` text NOT NULL,
	`calories` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`ingredients_json` text DEFAULT '[]' NOT NULL,
	`steps_json` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_daily_meals_plan_date` ON `daily_meals` (`plan_id`,`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_daily_meals_user_date` ON `daily_meals` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shopping_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` text NOT NULL,
	`reason` text,
	`purchased` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shopping_items_plan` ON `shopping_items` (`plan_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ai_insights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`category` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`related_plan_id` integer,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_insights_user_created` ON `ai_insights` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_insights_user_unread` ON `ai_insights` (`user_id`,`read_at`);