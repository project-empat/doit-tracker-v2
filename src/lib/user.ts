import { getDb } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export async function getUserById(id: string): Promise<User | undefined> {
	const db = getDb();
	const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return result[0];
}

export async function getUserByEmail(
	email: string,
): Promise<User | undefined> {
	const db = getDb();
	const result = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	return result[0];
}

export async function createUser(userData: NewUser): Promise<User> {
	const db = getDb();
	const result = await db.insert(users).values(userData).returning();
	return result[0]!;
}

export async function getOrCreateUser(userData: {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
}): Promise<User> {
	const existing = await getUserByEmail(userData.email);
	if (existing) {
		// Update name/image if changed
		if (existing.name !== userData.name || existing.image !== userData.image) {
			const db = getDb();
			const result = await db
				.update(users)
				.set({ name: userData.name, image: userData.image })
				.where(eq(users.email, userData.email))
				.returning();
			return result[0]!;
		}
		return existing;
	}
	return createUser(userData);
}
