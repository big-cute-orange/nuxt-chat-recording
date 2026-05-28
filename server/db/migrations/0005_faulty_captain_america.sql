CREATE TABLE `judge_results` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_a` text NOT NULL,
	`provider_b` text NOT NULL,
	`judge_provider` text NOT NULL,
	`winner` text NOT NULL,
	`scores_a` text NOT NULL,
	`scores_b` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `judge_results_provider_a_idx` ON `judge_results` (`provider_a`);--> statement-breakpoint
CREATE INDEX `judge_results_provider_b_idx` ON `judge_results` (`provider_b`);--> statement-breakpoint
CREATE INDEX `judge_results_judge_provider_idx` ON `judge_results` (`judge_provider`);--> statement-breakpoint
CREATE INDEX `judge_results_created_at_idx` ON `judge_results` (`created_at`);