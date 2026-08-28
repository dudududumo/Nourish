CREATE TABLE `coach_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`response_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_coach_messages_user_date` ON `coach_messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `fridge_zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`zone_type` text NOT NULL,
	`capacity_liters` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fridge_zones_user_name` ON `fridge_zones` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`zone_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`estimated_liters` real,
	`purchased_at` text,
	`expires_at` text,
	`status` text DEFAULT 'available' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_user_status_expiry` ON `inventory` (`user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_inventory_zone` ON `inventory` (`zone_id`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`measured_at` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`weight_kg` real NOT NULL,
	`bmi` real,
	`body_fat_pct` real,
	`fat_mass_kg` real,
	`muscle_mass_kg` real,
	`muscle_pct` real,
	`skeletal_muscle_kg` real,
	`fat_free_mass_kg` real,
	`body_water_pct` real,
	`body_water_kg` real,
	`protein_pct` real,
	`protein_kg` real,
	`bone_mass_kg` real,
	`bone_salt_pct` real,
	`visceral_fat_level` real,
	`bmr_kcal` real,
	`waist_hip_ratio` real,
	`heart_rate_bpm` real,
	`body_score` real,
	`body_age` real
);
--> statement-breakpoint
CREATE INDEX `idx_measurements_user_date` ON `measurements` (`user_id`,`measured_at`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`plan_json` text NOT NULL,
	`rationale_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plans_user_start` ON `plans` (`user_id`,`starts_on`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`biological_sex` text,
	`birth_date` text,
	`height_cm` real,
	`goal` text DEFAULT 'healthy_recomposition' NOT NULL,
	`health_screening_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
