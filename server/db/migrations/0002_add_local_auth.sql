ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN username TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN password_hash TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);
