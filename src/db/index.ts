import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

let db: DrizzleD1Database<typeof schema>;
let initialized = false;

export function initializeDb(env?: { DB: D1Database }) {
	if (initialized) {
		return getDb();
	}
	if (!env?.DB) {
		throw new Error("D1 database binding not available");
	}
	db = drizzle(env.DB, { schema });
	initialized = true;
	return db;
}

export function getDb() {
	if (!initialized || !db) {
		throw new Error(
			"Database not initialized. Call initializeDb() first.",
		);
	}
	return db;
}
