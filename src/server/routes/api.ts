import { Hono } from "hono";
import type { Context } from "hono";
import { nanoid } from "nanoid";
import { getSession } from "../auth";
import { initializeDb, getDb } from "../../db";
import type { HabitRecord } from "../../db/schema";
import {
	getUserHabits,
	todayStr,
	getRecord,
	createOrUpdateRecord,
	dailyMomentumForDate,
	getWeekRange,
	weeklyMomentum,
	totalMomentum,
	momentumHistory,
	formatDate,
	archiveHabit,
	createHabit,
	getHabit,
	toCamelHabit,
	toCamelRecord,
} from "../../lib/habits";
import { getUserById } from "../../lib/user";

type Env = { Bindings: { DB: D1Database } };

interface UserInfo { id: string; name?: string; email?: string; image?: string }

const api = new Hono<Env>();

function getUser(session: Record<string, unknown>): UserInfo | null {
	const u = session.user as Record<string, unknown> | undefined;
	if (!u?.id) return null;
	return { id: u.id as string, name: u.name as string | undefined, email: u.email as string | undefined, image: u.image as string | undefined };
}

async function requireAuth(c: Context): Promise<UserInfo | null> {
	const session = await getSession(c);
	if (!session) { c.status(401); return null; }
	return getUser(session);
}

api.get("/dashboard/total-momentum", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	return c.json({ totalMomentum: await totalMomentum(user.id) });
});

api.get("/dashboard/daily-habits", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const habits = await getUserHabits(user.id, "daily");
	const today = todayStr();
	const results = await Promise.all(
		habits.map(async (h) => {
			const rec = await getRecord(h.id, today);
			const cm = rec?.momentum ?? (await dailyMomentumForDate(h.id, user.id, today, 0));
			return { ...toCamelHabit(h), todayRecord: rec ? toCamelRecord(rec) : null, currentMomentum: cm, isEffectivelyCompleted: (rec?.completed ?? 0) > 0 };
		}),
	);
	return c.json({ dailyHabits: results });
});

api.get("/dashboard/weekly-habits", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const habits = await getUserHabits(user.id, "weekly");
	const week = getWeekRange();
	const results = await Promise.all(
		habits.map(async (h) => {
			const db = getDb();
			const records = await db.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date >= ? AND date <= ?").bind(h.id, week.start, week.end).all<HabitRecord>();
			const completionsThisWeek = records.results.filter((r) => r.completed > 0).length;
			const wm = await weeklyMomentum(h, user.id, week.start, week.end);
			return { ...toCamelHabit(h), completionsThisWeek, targetMet: completionsThisWeek >= (h.target_count ?? 2), currentMomentum: wm };
		}),
	);
	return c.json({ weeklyHabits: results, currentWeek: week });
});

api.get("/dashboard/momentum-history", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	return c.json({ momentumHistory: await momentumHistory(user.id) });
});

api.post("/habits/create", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const dbUser = await getUserById(user.id);
	if (!dbUser) return c.json({ success: false, error: "User not found." });
	const body = await c.req.json<{ name: string; description?: string; type: "daily" | "weekly"; targetCount?: number }>();
	if (!body.name) return c.json({ success: false, error: "Name is required" });
	try {
		const habit = await createHabit({
			id: nanoid(), user_id: dbUser.id, name: body.name, description: body.description ?? null, type: body.type,
			target_count: body.type === "weekly" ? Math.max(2, body.targetCount ?? 2) : 1, accumulated_momentum: 0, created_at: new Date(), archived_at: null,
		});
		return c.json({ success: true, habit: toCamelHabit(habit) });
	} catch (err) { return c.json({ success: false, error: String(err) }); }
});

api.post("/habits/archive", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const body = await c.req.json<{ habitId: string }>();
	if (!body.habitId) return c.json({ success: false, error: "Habit ID required" });
	const habit = await getHabit(body.habitId);
	if (!habit || habit.user_id !== user.id) return c.json({ success: false, error: "Not found" });
	await archiveHabit(body.habitId);
	return c.json({ success: true });
});

api.post("/habits/track", async (c) => {
	const user = await requireAuth(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const body = await c.req.json<{ habitId: string; completed?: boolean; date?: string }>();
	if (!body.habitId) return c.json({ success: false, error: "Habit ID required" });
	const habit = await getHabit(body.habitId);
	if (!habit || habit.user_id !== user.id) return c.json({ success: false, error: "Not found" });

	if (habit.type === "weekly") {
		const date = body.date ? formatDate(new Date(body.date)) : todayStr();
		const week = getWeekRange(new Date(date));
		const db = getDb();
		const existing = await db.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date = ? LIMIT 1").bind(body.habitId, date).first<HabitRecord>();
		const finalCompleted = existing?.completed ? 0 : 1;
		const wm = await weeklyMomentum(habit, user.id, week.start, week.end);
		await createOrUpdateRecord({ habitId: body.habitId, userId: user.id, date, completed: finalCompleted, momentum: wm });
		await db.prepare("UPDATE habit_records SET momentum = ? WHERE habit_id = ? AND date >= ? AND date <= ?").bind(wm, body.habitId, week.start, week.end).run();
		return c.json({ success: true, completed: finalCompleted, momentum: wm });
	}

	const date = todayStr();
	const existing = await getRecord(body.habitId, date);
	const completed = existing?.completed ? 0 : 1;
	const record = await createOrUpdateRecord({ habitId: body.habitId, userId: user.id, date, completed });
	return c.json({ success: true, completed, momentum: record.momentum, record: toCamelRecord(record) });
});

export default api;
