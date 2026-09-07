CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`scope` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cases_owner` ON `cases` (`owner`);--> statement-breakpoint
CREATE TABLE `custody` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`evidence_id` text NOT NULL,
	`case_id` text NOT NULL,
	`from_name` text NOT NULL,
	`to_name` text NOT NULL,
	`reason` text NOT NULL,
	`time` text NOT NULL,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_custody_owner_evidence` ON `custody` (`owner`,`evidence_id`);--> statement-breakpoint
CREATE INDEX `idx_custody_owner_case` ON `custody` (`owner`,`case_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`time` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`payload` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_owner_time` ON `events` (`owner`,`time`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`case_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`custodian` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`object_key` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_owner_case` ON `evidence` (`owner`,`case_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`case_id` text NOT NULL,
	`title` text NOT NULL,
	`assignee` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_case` ON `tasks` (`owner`,`case_id`);
