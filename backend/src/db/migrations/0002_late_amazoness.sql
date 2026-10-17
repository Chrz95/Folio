CREATE TABLE `custom_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "category_archive_boolean" CHECK("custom_categories"."is_archived" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_categories_normalized_name_unique` ON `custom_categories` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "goal_contribution_nonzero" CHECK("goal_contributions"."amount" != 0)
);
--> statement-breakpoint
CREATE INDEX `goal_contribution_goal` ON `goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE TABLE `monthly_budgets` (
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`rollover` integer NOT NULL,
	PRIMARY KEY(`month`, `category`),
	CONSTRAINT "monthly_amount_nonnegative" CHECK("monthly_budgets"."amount" >= 0),
	CONSTRAINT "monthly_rollover_boolean" CHECK("monthly_budgets"."rollover" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`target_date` text,
	`is_archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "goal_target_positive" CHECK("savings_goals"."target_amount" > 0),
	CONSTRAINT "goal_archive_boolean" CHECK("savings_goals"."is_archived" in (0, 1))
);
