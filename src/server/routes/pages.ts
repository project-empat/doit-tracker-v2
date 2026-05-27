import { Hono } from "hono";
import type { Context } from "hono";
import { getSession } from "../auth";
import { initializeDb, getDb } from "../../db";
import type { HabitRecord } from "../../db/schema";
import {
	getUserHabits,
	todayStr,
	getRecord,
	formatDate,
	getWeekRange,
	weeklyMomentum,
	getTodayRecords,
	getRecordsByHabitAndDate,
	getRecordsGroupedByHabit,
	buildMomentumHistory,
	calcDailyMomentum,
	toCamelHabit,
	toCamelRecord,
} from "../../lib/habits";

type Env = { Bindings: { DB: D1Database } };

const pages = new Hono<Env>();

function getUser(session: Record<string, unknown>) {
	const u = session.user as Record<string, unknown> | undefined;
	if (!u?.id) return null;
	return { id: u.id as string, name: u.name as string | undefined, email: u.email as string | undefined, image: u.image as string | undefined };
}

async function ensureSession(c: Context) {
	const session = await getSession(c);
	if (!session) return null;
	return getUser(session);
}

pages.get("/", async (c) => {
	const session = await getSession(c);
	return c.render("Home", { session: session ?? null });
});

pages.get("/login", (c) => c.render("Login", {}));

// ─── Dashboard ───────────────────────────────────────────────────────────────

pages.get("/dashboard", async (c) => {
	const user = await ensureSession(c);
	if (!user) return c.redirect("/login");

	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const userId = user.id;

	const [dailyHabits, weeklyHabits] = await Promise.all([
		getUserHabits(userId, "daily"),
		getUserHabits(userId, "weekly"),
	]);

	const allHabitIds = [...dailyHabits, ...weeklyHabits].map((h) => h.id);
	const today = todayStr();
	const week = getWeekRange();

	const todayRecords = await getTodayRecords(allHabitIds);

	let weekRecordsByHabit = new Map<string, HabitRecord[]>();
	if (weeklyHabits.length > 0) {
		weekRecordsByHabit = await getRecordsGroupedByHabit(weeklyHabits.map((h) => h.id), week.start);
	}

	const allRecords = await getRecordsByHabitAndDate(allHabitIds, formatDate(new Date(Date.now() - 60 * 86400000)));
	const hist = await buildMomentumHistory({ userId, dailyHabitsList: dailyHabits, weeklyHabitsList: weeklyHabits, records: allRecords });
	const total = hist.length > 0 ? hist[hist.length - 1]!.momentum : 0;

	const dailyWithRecords = dailyHabits.map((h) => {
		const recRaw = todayRecords.get(h.id) ?? null;
		const rec = recRaw ? toCamelRecord(recRaw) : null;
		return { ...toCamelHabit(h), todayRecord: rec, currentMomentum: rec?.momentum ?? calcDailyMomentum(0, undefined, today), isEffectivelyCompleted: (rec?.completed ?? 0) > 0 };
	});

	const weeklyWithRecords = weeklyHabits.map((h) => {
		const records = weekRecordsByHabit.get(h.id) ?? [];
		const completionsThisWeek = records.filter((r) => r.completed > 0).length;
		return { ...toCamelHabit(h), completionsThisWeek, targetMet: completionsThisWeek >= (h.target_count ?? 2), currentMomentum: completionsThisWeek };
	});

	return c.render("Dashboard", {
		user: { name: user.name ?? "User", email: user.email, image: user.image },
		dailyHabits: dailyWithRecords,
		weeklyHabits: weeklyWithRecords,
		totalMomentum: total,
		momentumHistory: hist,
		currentWeek: week,
	});
});

// ─── Daily Habits ────────────────────────────────────────────────────────────

pages.get("/habits/daily", async (c) => {
	const user = await ensureSession(c);
	if (!user) return c.redirect("/login");

	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const userId = user.id;
	const dailyHabits = await getUserHabits(userId, "daily");
	const habitIds = dailyHabits.map((h) => h.id);
	const today = todayStr();

	const sevenDaysAgo = formatDate(new Date(Date.now() - 6 * 86400000));
	const recordsMap = await getRecordsByHabitAndDate(habitIds, sevenDaysAgo, today);

	const todayRecords = new Map<string, HabitRecord>();
	for (const [key, rec] of recordsMap) {
		const [hid, d] = key.split("_") as [string, string];
		if (d === today) todayRecords.set(hid, rec);
	}

	const habitsWithData = dailyHabits.map((h) => {
		const recRaw = todayRecords.get(h.id) ?? null;
		const rec = recRaw ? toCamelRecord(recRaw) : null;

		const history: { date: string; momentum: number | null }[] = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const ds = formatDate(d);
			const r = recordsMap.get(`${h.id}_${ds}`);
			history.push({ date: ds, momentum: r?.momentum ?? null });
		}

		return { ...toCamelHabit(h), todayRecord: rec, currentMomentum: rec?.momentum ?? 0, momentumHistory: history };
	});

	return c.render("DailyHabits", { habits: habitsWithData });
});

// ─── Weekly Habits ───────────────────────────────────────────────────────────

pages.get("/habits/weekly", async (c) => {
	const user = await ensureSession(c);
	if (!user) return c.redirect("/login");

	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const userId = user.id;
	const weeklyHabits = await getUserHabits(userId, "weekly");
	const habitIds = weeklyHabits.map((h) => h.id);
	const currentWeek = getWeekRange();

	const db = getDb();

	const allWeekRecords: HabitRecord[] =
		habitIds.length > 0
			? (await db.prepare("SELECT * FROM habit_records WHERE user_id = ? AND date >= ? AND date <= ?").bind(userId, currentWeek.start, currentWeek.end).all<HabitRecord>()).results
			: [];

	const weekRecordsByHabit = new Map<string, HabitRecord[]>();
	for (const id of habitIds) weekRecordsByHabit.set(id, []);
	for (const r of allWeekRecords) weekRecordsByHabit.get(r.habit_id)?.push(r);

	const eightWeeksAgo = formatDate(new Date(Date.now() - 56 * 86400000));
	const allHistory: HabitRecord[] =
		habitIds.length > 0
			? (await db.prepare("SELECT * FROM habit_records WHERE user_id = ? AND date >= ? ORDER BY date").bind(userId, eightWeeksAgo).all<HabitRecord>()).results
			: [];

	const historyByHabit = new Map<string, HabitRecord[]>();
	for (const id of habitIds) historyByHabit.set(id, []);
	for (const r of allHistory) historyByHabit.get(r.habit_id)?.push(r);

	const habitsWithData = weeklyHabits.map((h) => {
		const records = weekRecordsByHabit.get(h.id) ?? [];
		const completionsThisWeek = records.filter((r) => r.completed > 0).length;

		const weeklyMap = new Map<string, { date: string; momentum: number }>();
		weeklyMap.set(currentWeek.start, { date: currentWeek.start, momentum: completionsThisWeek });

		const allHr = historyByHabit.get(h.id) ?? [];
		for (const record of allHr) {
			const rd = new Date(record.date);
			const ws = new Date(rd);
			ws.setDate(ws.getDate() - ws.getDay());
			const wk = formatDate(ws);
			if (wk !== currentWeek.start) weeklyMap.set(wk, { date: record.date, momentum: record.momentum });
		}

		let momentumHistory = Array.from(weeklyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
		while (momentumHistory.length < 8) {
			const earliest = momentumHistory[0]?.date ?? currentWeek.start;
			const prevWeek = new Date(earliest);
			prevWeek.setDate(prevWeek.getDate() - 7);
			momentumHistory.unshift({ date: formatDate(prevWeek), momentum: -1 });
		}
		if (momentumHistory.length > 8) momentumHistory = momentumHistory.slice(-8);

		return {
			...toCamelHabit(h),
			weekRecords: weekRecordsByHabit.get(h.id)?.map((r) => toCamelRecord(r)) ?? [],
			completionsThisWeek,
			targetMet: completionsThisWeek >= (h.target_count ?? 2),
			currentMomentum: completionsThisWeek,
			momentumHistory,
		};
	});

	return c.render("WeeklyHabits", { habits: habitsWithData, currentWeek });
});

// ─── Static pages ────────────────────────────────────────────────────────────

pages.get("/privacy", (c) => c.render("Privacy", {}));
pages.get("/terms", (c) => c.render("Terms", {}));

export default pages;
