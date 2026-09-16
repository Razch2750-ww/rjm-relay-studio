CREATE TABLE `relay_projects` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
