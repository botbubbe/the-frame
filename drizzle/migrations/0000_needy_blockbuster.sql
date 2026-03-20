CREATE TABLE `activity_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`module` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`data` text,
	`user_id` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`user_id` text,
	`permissions` text,
	`last_used_at` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `change_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text DEFAULT (datetime('now')),
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`user_id` text,
	`source` text NOT NULL,
	`agent_type` text,
	`request_id` text
);
--> statement-breakpoint
CREATE TABLE `error_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text DEFAULT (datetime('now')),
	`level` text NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`stack_trace` text,
	`request_method` text,
	`request_path` text,
	`request_body` text,
	`user_id` text,
	`ip_address` text,
	`metadata` text,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_at` text,
	`resolved_by` text
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`module` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`output` text,
	`priority` integer DEFAULT 2 NOT NULL,
	`scheduled_for` text,
	`recurring` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (datetime('now')),
	`started_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `reporting_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text DEFAULT (datetime('now')),
	`event_type` text NOT NULL,
	`module` text NOT NULL,
	`user_id` text,
	`metadata` text,
	`duration_ms` integer,
	`tokens_used` integer,
	`cost_cents` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`type` text DEFAULT 'string' NOT NULL,
	`module` text,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'support' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);