import { Hono } from "hono";
import type { Context } from "hono";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import * as v from "valibot";
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
import { dbEffect, NotFoundError, ValidationError } from "../utils/effect-errors";
import { runEffect } from "../utils/effect-runtime";

type Env = { Bindings: { DB: D1Database } };

const api = new Hono<Env>();

async function requireUserId(c: Context): Promise<string | null> {
	const session = await getSession(c);
	const u = session?.user as Record<string, unknown> | undefined;
	if (!u?.id) { c.status(401); return null; }
	return u.id as string;
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const CreateHabitSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	description: v.optional(v.string()),
	type: v.union([v.literal("daily"), v.literal("weekly")]),
	targetCount: v.optional(v.number()),
});

const ArchiveHabitSchema = v.object({
	habitId: v.pipe(v.string(), v.minLength(1, "Habit ID required")),
});

const TrackHabitSchema = v.object({
	habitId: v.pipe(v.string(), v.minLength(1, "Habit ID required")),
	completed: v.optional(v.boolean()),
	date: v.optional(v.string()),
});

function parseOrFail<T>(schema: v.GenericSchema<T>, input: unknown): Effect.Effect<T, ValidationError> {
	return Effect.try({
		try: () => {
			const result = v.safeParse(schema, input);
			if (result.success) return result.output;
			const issues = result.issues.map((i) => `${i.path?.join(".") ?? ""}: ${i.message}`).join("; ");
			throw new ValidationError({ message: `Validation failed: ${issues}` });
		},
		catch: (e) => e instanceof ValidationError ? e : new ValidationError({ message: "Invalid input" }),
	});
}

// ─── Dashboard API ───────────────────────────────────────────────────────────

api.get("/dashboard/total-momentum", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const result = await Effect.runPromise(dbEffect(() => totalMomentum(userId)));
	return c.json({ totalMomentum: result });
});

api.get("/dashboard/daily-habits", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);

	const program = Effect.gen(function* () {
		const habits = yield* dbEffect(() => getUserHabits(userId, "daily"));
		const today = todayStr();
		const results: Record<string, unknown>[] = [];
		for (const h of habits) {
			const rec = yield* dbEffect(() => getRecord(h.id, today));
			const cm = rec?.momentum ?? (yield* dbEffect(() => dailyMomentumForDate(h.id, userId, today, 0)));
			results.push({
				...toCamelHabit(h),
				todayRecord: rec ? toCamelRecord(rec) : null,
				currentMomentum: cm,
				isEffectivelyCompleted: (rec?.completed ?? 0) > 0,
			});
		}
		return { dailyHabits: results };
	});
	return runEffect(c, program);
});

api.get("/dashboard/weekly-habits", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);

	const program = Effect.gen(function* () {
		const habits = yield* dbEffect(() => getUserHabits(userId, "weekly"));
		const week = getWeekRange();
		const results: Record<string, unknown>[] = [];
		for (const h of habits) {
			const db = getDb();
			const records = yield* dbEffect(() =>
				db.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date >= ? AND date <= ?")
					.bind(h.id, week.start, week.end).all<HabitRecord>(),
			);
			const completionsThisWeek = records.results.filter((r) => r.completed > 0).length;
			const wm = yield* dbEffect(() => weeklyMomentum(h, userId, week.start, week.end));
			results.push({ ...toCamelHabit(h), completionsThisWeek, targetMet: completionsThisWeek >= (h.target_count ?? 2), currentMomentum: wm });
		}
		return { weeklyHabits: results, currentWeek: week };
	});
	return runEffect(c, program);
});

api.get("/dashboard/momentum-history", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const program = dbEffect(() => momentumHistory(userId));
	return runEffect(c, program.pipe(Effect.map((hist) => ({ momentumHistory: hist }))));
});

// ─── Habit CRUD ──────────────────────────────────────────────────────────────

api.post("/habits/create", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);

	const program = Effect.gen(function* () {
		const dbUser = yield* dbEffect(() => getUserById(userId));
		if (!dbUser) return yield* Effect.fail(new NotFoundError({ message: "User not found" }));

		const raw = yield* Effect.tryPromise({
			try: () => c.req.json(),
			catch: () => new ValidationError({ message: "Invalid JSON body" }),
		});
		const body = yield* parseOrFail(CreateHabitSchema, raw);

		const habit = yield* dbEffect(() =>
			createHabit({
				id: nanoid(), user_id: dbUser.id, name: body.name, description: body.description ?? null,
				type: body.type, target_count: body.type === "weekly" ? Math.max(2, body.targetCount ?? 2) : 1,
				accumulated_momentum: 0, created_at: new Date(), archived_at: null,
			}),
		);
		return { success: true, habit: toCamelHabit(habit) };
	});
	return runEffect(c, program);
});

api.post("/habits/archive", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);

	const program = Effect.gen(function* () {
		const raw = yield* Effect.tryPromise({
			try: () => c.req.json(),
			catch: () => new ValidationError({ message: "Invalid JSON body" }),
		});
		const body = yield* parseOrFail(ArchiveHabitSchema, raw);

		const habit = yield* dbEffect(() => getHabit(body.habitId));
		if (!habit || habit.user_id !== userId) return yield* Effect.fail(new NotFoundError({ message: "Habit not found" }));

		yield* dbEffect(() => archiveHabit(body.habitId));
		return { success: true };
	});
	return runEffect(c, program);
});

api.post("/habits/track", async (c) => {
	const userId = await requireUserId(c);
	if (!userId) return c.json({ error: "Unauthorized" }, 401);
	const env = c.env as { DB: D1Database };
	initializeDb(env);

	const program = Effect.gen(function* () {
		const raw = yield* Effect.tryPromise({
			try: () => c.req.json(),
			catch: () => new ValidationError({ message: "Invalid JSON body" }),
		});
		const body = yield* parseOrFail(TrackHabitSchema, raw);

		const habit = yield* dbEffect(() => getHabit(body.habitId));
		if (!habit || habit.user_id !== userId) return yield* Effect.fail(new NotFoundError({ message: "Habit not found" }));

		if (habit.type === "weekly") {
			const date = body.date ? formatDate(new Date(body.date)) : todayStr();
			const week = getWeekRange(new Date(date));
			const db = getDb();
			const existing = yield* dbEffect(() =>
				db.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date = ? LIMIT 1")
					.bind(body.habitId, date).first<HabitRecord>(),
			);
			const finalCompleted = existing?.completed ? 0 : 1;
			const wm = yield* dbEffect(() => weeklyMomentum(habit, userId, week.start, week.end));
			yield* dbEffect(() => createOrUpdateRecord({ habitId: body.habitId, userId, date, completed: finalCompleted, momentum: wm }));
			yield* dbEffect(() =>
				db.prepare("UPDATE habit_records SET momentum = ? WHERE habit_id = ? AND date >= ? AND date <= ?")
					.bind(wm, body.habitId, week.start, week.end).run(),
			);
			return { success: true, completed: finalCompleted, momentum: wm };
		}

		const date = todayStr();
		const existing = yield* dbEffect(() => getRecord(body.habitId, date));
		const completed = existing?.completed ? 0 : 1;
		const record = yield* dbEffect(() => createOrUpdateRecord({ habitId: body.habitId, userId, date, completed }));
		return { success: true, completed, momentum: record.momentum, record: toCamelRecord(record) };
	});
	return runEffect(c, program);
});

export default api;
