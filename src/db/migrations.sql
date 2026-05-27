CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	image TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habits (
	id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	description TEXT,
	type TEXT NOT NULL CHECK(type IN ('daily', 'weekly')),
	target_count INTEGER DEFAULT 1,
	accumulated_momentum INTEGER DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	archived_at TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS habit_records (
	id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
	habit_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	date TEXT NOT NULL,
	completed INTEGER NOT NULL DEFAULT 0,
	momentum INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS habit_records_habit_date_idx
	ON habit_records(habit_id, date);
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits(user_id);
CREATE INDEX IF NOT EXISTS habit_records_user_id_idx ON habit_records(user_id);
CREATE INDEX IF NOT EXISTS habit_records_date_idx ON habit_records(date);
