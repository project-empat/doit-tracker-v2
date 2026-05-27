import { getDb } from "../db";
import type { User } from "../db/schema";

export async function getUserById(id: string): Promise<User | undefined> {
	const db = getDb();
	const r = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
	return r ?? undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
	const db = getDb();
	const r = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
	return r ?? undefined;
}

export async function createUser(userData: {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
}): Promise<User> {
	const db = getDb();
	const r = await db
		.prepare("INSERT INTO users (id, email, name, image) VALUES (?, ?, ?, ?) RETURNING *")
		.bind(userData.id, userData.email, userData.name, userData.image)
		.first<User>();
	if (!r) throw new Error("Failed to create user");
	return r;
}

export async function getOrCreateUser(userData: {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
}): Promise<User> {
	const existing = await getUserByEmail(userData.email);
	if (existing) {
		if (existing.name !== userData.name || existing.image !== userData.image) {
			const db = getDb();
			const r = await db
				.prepare("UPDATE users SET name = ?, image = ? WHERE email = ? RETURNING *")
				.bind(userData.name, userData.image, userData.email)
				.first<User>();
			if (!r) throw new Error("Failed to update user");
			return r;
		}
		return existing;
	}
	return createUser(userData);
}
