CREATE TABLE `schedule_settings` (
	`recurring_id` text PRIMARY KEY NOT NULL,
	`is_paused` integer NOT NULL,
	`end_date` text,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "schedule_pause_boolean" CHECK("schedule_settings"."is_paused" in (0,1))
);
--> statement-breakpoint
CREATE TABLE `skipped_occurrences` (
	`recurring_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`recurring_id`, `date`),
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade
);
