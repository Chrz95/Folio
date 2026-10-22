PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_schedule_settings` (
	`recurring_id` text PRIMARY KEY NOT NULL,
	`is_paused` integer NOT NULL,
	`end_date` text,
	`auto_confirm` integer DEFAULT false NOT NULL,
	`auto_confirm_from` text,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "schedule_pause_boolean" CHECK("__new_schedule_settings"."is_paused" in (0,1)),
	CONSTRAINT "schedule_auto_boolean" CHECK("__new_schedule_settings"."auto_confirm" in (0,1)),
	CONSTRAINT "schedule_auto_start" CHECK("__new_schedule_settings"."auto_confirm" = 0 or "__new_schedule_settings"."auto_confirm_from" is not null)
);
--> statement-breakpoint
-- New activation fields are initialized explicitly; they do not exist in pre-1.15 databases.
INSERT INTO `__new_schedule_settings`
  ("recurring_id", "is_paused", "end_date", "auto_confirm", "auto_confirm_from")
SELECT "recurring_id", "is_paused", "end_date", 0, NULL FROM `schedule_settings`;
--> statement-breakpoint
DROP TABLE `schedule_settings`;--> statement-breakpoint
ALTER TABLE `__new_schedule_settings` RENAME TO `schedule_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;