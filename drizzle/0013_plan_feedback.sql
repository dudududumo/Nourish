CREATE TABLE IF NOT EXISTS `plan_feedback` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `plan_id` integer NOT NULL,
  `date` text NOT NULL,
  `execution` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_plan_feedback_user_plan_date` ON `plan_feedback` (`user_id`,`plan_id`,`date`);
