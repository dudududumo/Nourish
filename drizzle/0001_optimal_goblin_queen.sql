CREATE TABLE `ai_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text NOT NULL
);
