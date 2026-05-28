CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`description` text,
	`assignee` text,
	`due_date` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`status` text DEFAULT 'TODO' NOT NULL,
	`external_service` text,
	`external_service_id` text,
	`external_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_items_meeting_id_idx` ON `action_items` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `action_items_user_id_idx` ON `action_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `action_items_external_service_idx` ON `action_items` (`external_service`);--> statement-breakpoint
CREATE TABLE `ai_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text,
	`provider` text NOT NULL,
	`prompt_version` text NOT NULL,
	`raw_output` text NOT NULL,
	`validation_passed` integer NOT NULL,
	`validation_errors` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_logs_provider_idx` ON `ai_logs` (`provider`);--> statement-breakpoint
CREATE INDEX `ai_logs_prompt_version_idx` ON `ai_logs` (`prompt_version`);--> statement-breakpoint
CREATE INDEX `ai_logs_created_at_idx` ON `ai_logs` (`created_at`);--> statement-breakpoint
DROP INDEX "action_items_meeting_id_idx";--> statement-breakpoint
DROP INDEX "action_items_user_id_idx";--> statement-breakpoint
DROP INDEX "action_items_external_service_idx";--> statement-breakpoint
DROP INDEX "ai_logs_provider_idx";--> statement-breakpoint
DROP INDEX "ai_logs_prompt_version_idx";--> statement-breakpoint
DROP INDEX "ai_logs_created_at_idx";--> statement-breakpoint
DROP INDEX "integrations_config_user_id_idx";--> statement-breakpoint
DROP INDEX "integrations_config_service_idx";--> statement-breakpoint
DROP INDEX "integrations_config_user_service_uq";--> statement-breakpoint
DROP INDEX "meetings_user_id_idx";--> statement-breakpoint
DROP INDEX "meetings_date_idx";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
DROP INDEX "users_username_idx";--> statement-breakpoint
DROP INDEX "users_provider_idx";--> statement-breakpoint
ALTER TABLE `integrations_config` ALTER COLUMN "updated_at" TO "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX `integrations_config_user_id_idx` ON `integrations_config` (`user_id`);--> statement-breakpoint
CREATE INDEX `integrations_config_service_idx` ON `integrations_config` (`service`);--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_config_user_service_uq` ON `integrations_config` (`user_id`,`service`);--> statement-breakpoint
CREATE INDEX `meetings_user_id_idx` ON `meetings` (`user_id`);--> statement-breakpoint
CREATE INDEX `meetings_date_idx` ON `meetings` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_provider_idx` ON `users` (`provider`);--> statement-breakpoint
ALTER TABLE `meetings` ALTER COLUMN "meeting_type" TO "meeting_type" text NOT NULL DEFAULT 'Meeting';--> statement-breakpoint
ALTER TABLE `meetings` ALTER COLUMN "created_at" TO "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;