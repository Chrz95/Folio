CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "receipt_size_valid" CHECK("receipts"."size" > 0 and "receipts"."size" <= 524288),
	CONSTRAINT "receipt_type_valid" CHECK("receipts"."mime_type" in ('image/png','image/jpeg','application/pdf'))
);
--> statement-breakpoint
CREATE INDEX `receipt_transaction` ON `receipts` (`transaction_id`);