let db: D1Database | null = null;

export function initializeDb(env?: { DB: D1Database }) {
	if (db) return db;
	if (!env?.DB) throw new Error("D1 database binding not available");
	db = env.DB;
	return db;
}

export function getDb(): D1Database {
	if (!db) throw new Error("Database not initialized. Call initializeDb() first.");
	return db;
}

export function resetDbForTest() {
	db = null;
}
