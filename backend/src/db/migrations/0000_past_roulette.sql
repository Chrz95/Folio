CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_unique` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`category` text PRIMARY KEY NOT NULL,
	`amount` integer NOT NULL,
	CONSTRAINT "budget_positive" CHECK("budgets"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`delivered_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`destination_account_id` text,
	`date` text NOT NULL,
	`frequency` text NOT NULL,
	`reminder_days` integer DEFAULT 1 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recurring_amount_positive" CHECK("recurring"."amount" > 0),
	CONSTRAINT "recurring_type_valid" CHECK("recurring"."type" in ('expense','income','transfer')),
	CONSTRAINT "recurring_frequency_valid" CHECK("recurring"."frequency" in ('once','weekly','monthly','yearly')),
	CONSTRAINT "reminder_days_valid" CHECK("recurring"."reminder_days" between 0 and 7),
	CONSTRAINT "recurring_transfer_valid" CHECK(("recurring"."type" = 'transfer' AND "recurring"."destination_account_id" IS NOT NULL
 AND "recurring"."destination_account_id" != "recurring"."account_id") OR ("recurring"."type" != 'transfer'
 AND "recurring"."destination_account_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`destination_account_id` text,
	`date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`recurring_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transaction_amount_positive" CHECK("transactions"."amount" > 0),
	CONSTRAINT "transaction_type_valid" CHECK("transactions"."type" in ('expense','income','transfer')),
	CONSTRAINT "transaction_transfer_valid" CHECK(("transactions"."type" = 'transfer' AND "transactions"."destination_account_id" IS NOT NULL
 AND "transactions"."destination_account_id" != "transactions"."account_id") OR ("transactions"."type" != 'transfer'
 AND "transactions"."destination_account_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `transactions` (`date`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_occurrence_unique` ON `transactions` (`recurring_id`,`date`);