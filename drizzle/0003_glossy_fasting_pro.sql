ALTER TABLE `profiles` ADD `weight_kg` real;
--> statement-breakpoint
ALTER TABLE `fasting_settings` ADD `goal` text DEFAULT 'fat_loss' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fasting_settings` ADD `window_end_hour` integer DEFAULT 20 NOT NULL;
--> statement-breakpoint
ALTER TABLE `fasting_logs` ADD `plan_hours` integer;
--> statement-breakpoint
ALTER TABLE `fasting_logs` ADD `energy` integer;
--> statement-breakpoint
ALTER TABLE `fasting_logs` ADD `hunger` integer;