CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`case_id` text NOT NULL,
	`evidence_id` text,
	`import_id` text,
	`title` text NOT NULL,
	`asset` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`recommendation` text NOT NULL,
	`status` text NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_findings_owner_case` ON `findings` (`owner`,`case_id`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`case_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`connector` text NOT NULL,
	`parser_version` text NOT NULL,
	`source_sha256` text NOT NULL,
	`count` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_import_source` ON `imports` (`owner`,`case_id`,`connector`,`source_sha256`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`case_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`language` text NOT NULL,
	`markdown` text NOT NULL,
	`sha256` text NOT NULL,
	`status` text NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reports_owner_case` ON `reports` (`owner`,`case_id`);--> statement-breakpoint
CREATE TABLE `revision_guards` (
	`id` text PRIMARY KEY NOT NULL
);

