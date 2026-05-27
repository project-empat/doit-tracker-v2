import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSession } from "../auth";
import { initializeDb, getDb } from "../../db";
import { habitRecords } from "../../db/schema";
import {
	getUserHabits,
	todayStr,
	dailyMomentumForDate,
	getRecord,
	formatDate,
	getWeekRange,
	weeklyMomentum,
	totalMomentum,
	momentumHistory,
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

// ─── Home ────────────────────────────────────────────────────────────────────

pages.get("/", async (c) => {
	const session = await getSession(c);
	return c.render("Home", { session: session ?? null });
});

// ─── Login ───────────────────────────────────────────────────────────────────

pages.get("/login", (c) => c.render("Login", {}));

// ─── Dashboard ───────────────────────────────────────────────────────────────

pages.get("/dashboard", async (c) => {
	const user = await ensureSession(c);
	if (!user) return c.redirect("/login");

	const env = c.env as { DB: D1Database };
	initializeDb(env);
	const userId = user.id;

	const [dailyHabits, weeklyHabits, total, hist] = await Promise.all([
		getUserHabits(userId, "daily"),
		getUserHabits(userId, "weekly"),
		totalMomentum(userId),
		momentumHistory(userId),
	]);

	const today = todayStr();
	const week = getWeekRange();

	const dailyWithRecords = await Promise.all(
		dailyHabits.map(async (h) => {
			const rec = await getRecord(h.id, today);
			const cm = rec?.momentum ?? (await dailyMomentumForDate(h.id, userId, today, 0));
			return { ...h, todayRecord: rec, currentMomentum: cm, isEffectivelyCompleted: (rec?.completed ?? 0) > 0 };
		}),
	);

	const db = getDb();
	const weeklyWithRecords = await Promise.all(
		weeklyHabits.map(async (h) => {
			const records = await db
				.select()
				.from(habitRecords)
				.where(and(eq(habitRecords.habitId, h.id), gte(habitRecords.date, week.start), lte(habitRecords.date, week.end)));
			const completionsThisWeek = records.filter((r) => r.completed > 0).length;
			const wm = await weeklyMomentum(h, userId, week.start, week.end);
			return { ...h, completionsThisWeek, targetMet: completionsThisWeek >= (h.targetCount ?? 2), currentMomentum: wm };
		}),
	);

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
	const today = todayStr();

	const habitsWithData = await Promise.all(
		dailyHabits.map(async (h) => {
			const rec = await getRecord(h.id, today);
			const cm = rec?.momentum ?? (await dailyMomentumForDate(h.id, userId, today, 0));
			const history: { date: string; momentum: number | null }[] = [];
			for (let i = 6; i >= 0; i--) {
				const d = new Date();
				d.setDate(d.getDate() - i);
				const ds = formatDate(d);
				const r = await getRecord(h.id, ds);
				history.push({ date: ds, momentum: r?.momentum ?? null });
			}
			return { ...h, todayRecord: rec, currentMomentum: cm, accumulatedMomentum: h.accumulatedMomentum, momentumHistory: history };
		}),
	);

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
	const currentWeek = getWeekRange();

	const db = getDb();
	const habitsWithData = await Promise.all(
		weeklyHabits.map(async (h) => {
			const records = await db
				.select()
				.from(habitRecords)
				.where(and(eq(habitRecords.habitId, h.id), gte(habitRecords.date, currentWeek.start), lte(habitRecords.date, currentWeek.end)));

			const completionsThisWeek = records.filter((r) => r.completed > 0).length;
			const wm = await weeklyMomentum(h, userId, currentWeek.start, currentWeek.end);

			const weeklyMap = new Map<string, { date: string; momentum: number }>();
			weeklyMap.set(currentWeek.start, { date: currentWeek.start, momentum: wm });

			const eightWeeksAgo = new Date();
			eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
			const allHistoryRecords = await db
				.select()
				.from(habitRecords)
				.where(and(eq(habitRecords.habitId, h.id), gte(habitRecords.date, formatDate(eightWeeksAgo))))
				.orderBy(habitRecords.date);

			for (const record of allHistoryRecords) {
				const rd = new Date(record.date);
				const ws = new Date(rd);
				ws.setDate(ws.getDate() - ws.getDay());
				const wk = formatDate(ws);
				if (wk !== currentWeek.start) {
					weeklyMap.set(wk, { date: record.date, momentum: record.momentum });
				}
			}

			let momentumHistory = Array.from(weeklyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
			while (momentumHistory.length < 8) {
				const earliest = momentumHistory[0]?.date ?? currentWeek.start;
				const prevWeek = new Date(earliest);
				prevWeek.setDate(prevWeek.getDate() - 7);
				momentumHistory.unshift({ date: formatDate(prevWeek), momentum: -1 });
			}
			if (momentumHistory.length > 8) momentumHistory = momentumHistory.slice(-8);

			return { ...h, weekRecords: records, completionsThisWeek, targetMet: completionsThisWeek >= (h.targetCount ?? 2), currentMomentum: wm, accumulatedMomentum: h.accumulatedMomentum, momentumHistory };
		}),
	);

	return c.render("WeeklyHabits", { habits: habitsWithData, currentWeek });
});

// ─── Static pages ────────────────────────────────────────────────────────────

pages.get("/privacy", (c) => c.render("Privacy", {}));
pages.get("/terms", (c) => c.render("Terms", {}));

export default pages;
