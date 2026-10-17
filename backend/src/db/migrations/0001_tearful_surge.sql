CREATE TABLE `clearances` (
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`reconciliation_id` text,
	PRIMARY KEY(`transaction_id`, `account_id`),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reconciliation_id`) REFERENCES `reconciliations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_links` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`statement_balance` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reconciliation_account_date` ON `reconciliations` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `reminder_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`retry_after` integer NOT NULL,
	`count` integer NOT NULL,
	CONSTRAINT "attempt_status_valid" CHECK("reminder_attempts"."status" in ('sent','failed','expired')),
	CONSTRAINT "attempt_count_positive" CHECK("reminder_attempts"."count">0)
);
--> statement-breakpoint
CREATE INDEX `attempt_timestamp` ON `reminder_attempts` (`attempted_at`);--> statement-breakpoint
CREATE TABLE `reminder_preferences` (
	`id` integer PRIMARY KEY NOT NULL,
	`time_zone` text NOT NULL,
	`delivery_time` text NOT NULL,
	`mode` text NOT NULL,
	`overdue_days` integer NOT NULL,
	CONSTRAINT "reminder_mode_valid" CHECK("reminder_preferences"."mode" in ('individual','digest')),
	CONSTRAINT "overdue_days_valid" CHECK("reminder_preferences"."overdue_days" between 0 and 30),
	CONSTRAINT "singleton_preferences" CHECK("reminder_preferences"."id"=1)
);
--> statement-breakpoint
CREATE TABLE `reminder_snoozes` (
	`recurring_id` text NOT NULL,
	`date` text NOT NULL,
	`until` integer NOT NULL,
	PRIMARY KEY(`recurring_id`, `date`),
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade
);
