CREATE TABLE `rag_index_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`chunk_count` integer,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rag_index_jobs_meeting_id_unique` ON `rag_index_jobs` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `rag_index_jobs_meeting_id_idx` ON `rag_index_jobs` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `rag_index_jobs_user_id_idx` ON `rag_index_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `rag_index_jobs_status_idx` ON `rag_index_jobs` (`status`);