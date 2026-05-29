import { getDb } from "../db";
import type { Habit, HabitRecord } from "../db/schema";
import { nanoid } from "nanoid";

// ─── Date Utilities ──────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function todayStr(): string {
	return formatDate(new Date());
}

export function getWeekRange(date: Date = new Date()): { start: string; end: string } {
	const day = date.getDay();
	const monday = new Date(date);
	monday.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	return { start: formatDate(monday), end: formatDate(sunday) };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createHabit(data: {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	type: string;
	target_count: number;
	accumulated_momentum: number;
	created_at: Date;
	archived_at: Date | null;
}): Promise<Habit> {
	const db = getDb();
	const r = await db
		.prepare(
			"INSERT INTO habits (id, user_id, name, description, type, target_count, accumulated_momentum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
		)
		.bind(data.id, data.user_id, data.name, data.description, data.type, data.target_count, data.accumulated_momentum, data.created_at.toISOString())
		.first<Habit>();
	if (!r) throw new Error("Failed to create habit");
	return r;
}

export async function getHabit(id: string): Promise<Habit | undefined> {
	const db = getDb();
	const r = await db.prepare("SELECT * FROM habits WHERE id = ?").bind(id).first<Habit>();
	return r ?? undefined;
}

export async function getUserHabits(userId: string, type?: "daily" | "weekly"): Promise<Habit[]> {
	const db = getDb();
	if (type) {
		return db
			.prepare("SELECT * FROM habits WHERE archived_at IS NULL AND user_id = ? AND type = ? ORDER BY created_at")
			.bind(userId, type)
			.all<Habit>()
			.then((r) => r.results);
	}
	return db
		.prepare("SELECT * FROM habits WHERE archived_at IS NULL AND user_id = ? ORDER BY created_at")
		.bind(userId)
		.all<Habit>()
		.then((r) => r.results);
}

export async function getAllUserHabits(userId: string): Promise<{ daily: Habit[]; weekly: Habit[] }> {
	const all = await getUserHabits(userId);
	const daily: Habit[] = [];
	const weekly: Habit[] = [];
	for (const h of all) {
		if (h.type === "daily") daily.push(h);
		else weekly.push(h);
	}
	return { daily, weekly };
}

export async function archiveHabit(id: string): Promise<Habit | undefined> {
	const db = getDb();
	const r = await db
		.prepare("UPDATE habits SET archived_at = ? WHERE id = ? RETURNING *")
		.bind(new Date().toISOString(), id)
		.first<Habit>();
	return r ?? undefined;
}

// ─── Batch Query Helpers ─────────────────────────────────────────────────────

function buildInPlaceholders(n: number): string {
	return Array.from({ length: n }, () => "?").join(",");
}

export async function getRecordsByHabitAndDate(
	habitIds: string[],
	dateFrom: string,
	dateTo?: string,
): Promise<Map<string, HabitRecord>> {
	if (habitIds.length === 0) return new Map();
	const db = getDb();
	const placeholders = buildInPlaceholders(habitIds.length);
	const sql = dateTo
		? `SELECT * FROM habit_records WHERE habit_id IN (${placeholders}) AND date >= ? AND date <= ? ORDER BY date`
		: `SELECT * FROM habit_records WHERE habit_id IN (${placeholders}) AND date >= ? ORDER BY date`;
	const params = dateTo ? [...habitIds, dateFrom, dateTo] : [...habitIds, dateFrom];

	const rows = await db.prepare(sql).bind(...params).all<HabitRecord>();
	const map = new Map<string, HabitRecord>();
	for (const r of rows.results) map.set(`${r.habit_id}_${r.date}`, r);
	return map;
}

export async function getTodayRecords(habitIds: string[]): Promise<Map<string, HabitRecord>> {
	if (habitIds.length === 0) return new Map();
	const map = await getRecordsByHabitAndDate(habitIds, todayStr());
	const result = new Map<string, HabitRecord>();
	for (const [key, rec] of map) result.set(key.split("_")[0]!, rec);
	return result;
}

export async function getRecordsGroupedByHabit(
	habitIds: string[],
	fromDate: string,
): Promise<Map<string, HabitRecord[]>> {
	if (habitIds.length === 0) return new Map();
	const db = getDb();
	const placeholders = buildInPlaceholders(habitIds.length);
	const rows = await db
		.prepare(`SELECT * FROM habit_records WHERE habit_id IN (${placeholders}) AND date >= ? ORDER BY date`)
		.bind(...habitIds, fromDate)
		.all<HabitRecord>();

	const map = new Map<string, HabitRecord[]>();
	for (const id of habitIds) map.set(id, []);
	for (const r of rows.results) map.get(r.habit_id)?.push(r);
	return map;
}

export async function getRecord(habitId: string, date: string): Promise<HabitRecord | null> {
	const db = getDb();
	const r = await db
		.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date = ? LIMIT 1")
		.bind(habitId, date)
		.first<HabitRecord>();
	return r ?? null;
}

// ─── Create/Update Record ────────────────────────────────────────────────────

export async function createOrUpdateRecord({
	habitId,
	userId,
	date,
	completed = 1,
	momentum: providedMomentum,
}: {
	habitId: string;
	userId: string;
	date: string;
	completed?: number;
	momentum?: number | null;
}): Promise<HabitRecord> {
	const stdDate = date.split("T")[0]!;
	const db = getDb();

	const existing = await getRecord(habitId, stdDate);
	const habit = await getHabit(habitId);
	if (!habit) throw new Error(`Habit ${habitId} not found`);

	let momentumVal: number | null = providedMomentum ?? null;
	let oldMomentum = 0;

	if (habit.type === "daily" && momentumVal === null) {
		const last = await db
			.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date < ? ORDER BY date DESC LIMIT 1")
			.bind(habitId, stdDate)
			.first<HabitRecord>();

		if (last) {
			const gap = Math.floor(
				(new Date(stdDate).getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24),
			);
			if (gap > 1) {
				momentumVal = completed > 0 ? 1 : Math.max(-gap, -3);
			} else if (completed > 0) {
				momentumVal = last.completed > 0 ? Math.min(last.momentum + 1, 7) : 1;
			} else {
				momentumVal = last.completed > 0 ? 0 : Math.max(last.momentum - 1, -3);
			}
		} else {
			momentumVal = completed > 0 ? 1 : 0;
		}
	}

	let record: HabitRecord;

	if (existing) {
		oldMomentum = existing.momentum;
		const r = await db
			.prepare("UPDATE habit_records SET completed = ?, momentum = ? WHERE habit_id = ? AND date = ? RETURNING *")
			.bind(completed, momentumVal ?? existing.momentum, habitId, stdDate)
			.first<HabitRecord>();
		if (!r) throw new Error("Failed to update record");
		record = r;
	} else {
		const r = await db
			.prepare(
				"INSERT INTO habit_records (id, habit_id, user_id, date, completed, momentum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
			)
			.bind(nanoid(), habitId, userId, stdDate, completed, momentumVal ?? 0, new Date().toISOString())
			.first<HabitRecord>();
		if (!r) throw new Error("Failed to create record");
		record = r;
	}

	if (habit.type === "daily") {
		const delta = record.momentum - oldMomentum;
		if (delta !== 0) {
			await db
				.prepare("UPDATE habits SET accumulated_momentum = ? WHERE id = ?")
				.bind((habit.accumulated_momentum ?? 0) + delta, habitId)
				.run();
		}
	}

	return record;
}

// ─── Momentum (stateless, works on provided records) ─────────────────────────

export function calcDailyMomentum(
	completed: number,
	prevRecord: HabitRecord | undefined,
	_date: string,
): number {
	if (completed > 0) {
		if (prevRecord?.completed) {
			return Math.min(prevRecord.momentum + 1, 7);
		}
		return 1;
	}
	if (!prevRecord) return 0;
	if (prevRecord.momentum < 0) return Math.max(prevRecord.momentum - 1, -3);
	return 0;
}

export function calcWeeklyMomentum(
	completionsThisWeek: number,
	completionsPrevWeek: number,
	targetCount: number,
	allRecords: HabitRecord[],
	weekStart: string,
): number {
	const curMet = completionsThisWeek >= targetCount;
	const prevMet = completionsPrevWeek >= targetCount;

	let m = completionsThisWeek;

	if (curMet) {
		m += 10;
		if (prevMet) {
			m += 10;
			m = Math.min(m, 40);
		}
	} else if (!prevMet && completionsPrevWeek >= 0) {
		let misses = 1;
		const before = allRecords.filter((r) => r.date < weekStart).sort((a, b) => b.date.localeCompare(a.date));
		if (before.length > 0) {
			const lm = before[0]!.momentum;
			const penalty = lm - completionsPrevWeek;
			if (penalty === 0) misses = 2;
			else if (penalty === -10) misses = 3;
			else if (penalty <= -20) misses = 4;
		}
		m += misses === 2 ? -10 : misses === 3 ? -20 : misses >= 4 ? -30 : 0;
	}

	return m;
}

// ─── Momentum (DB-bound, kept for single-use callers) ────────────────────────

export async function dailyMomentum(
	habitId: string,
	_userId: string,
	date: string,
	completed: number,
): Promise<number> {
	const db = getDb();
	if (completed > 0) {
		const y = new Date(date);
		y.setDate(y.getDate() - 1);
		const prev = await getRecord(habitId, formatDate(y));
		return prev?.completed ? Math.min(prev.momentum + 1, 7) : 1;
	}
	const prev = await db
		.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date < ? ORDER BY date DESC LIMIT 1")
		.bind(habitId, date)
		.first<HabitRecord>();
	return prev ? (prev.momentum < 0 ? Math.max(prev.momentum - 1, -3) : 0) : 0;
}

export async function dailyMomentumForDate(
	habitId: string,
	userId: string,
	date: string,
	completed = 0,
	_prevRecord?: HabitRecord,
): Promise<number> {
	if (completed > 0) {
		return dailyMomentum(habitId, userId, date, completed);
	}
	// Preserve streak momentum from yesterday when there's no record for today
	const y = new Date(date);
	y.setDate(y.getDate() - 1);
	const prev = await getRecord(habitId, formatDate(y));
	if (prev?.completed) return prev.momentum;
	return dailyMomentum(habitId, userId, date, 0);
}

export async function weeklyMomentum(
	habit: Habit,
	userId: string,
	weekStart: string,
	weekEnd: string,
): Promise<number> {
	const db = getDb();
	const pwe = new Date(weekStart);
	pwe.setDate(pwe.getDate() - 1);
	const pws = new Date(pwe);
	pws.setDate(pwe.getDate() - 6);
	const pwsStr = formatDate(pws);
	const pweStr = formatDate(pwe);

	const rows = await db
		.prepare(
			"SELECT * FROM habit_records WHERE habit_id = ? AND date >= ? AND date <= ? ORDER BY date DESC",
		)
		.bind(habit.id, pwsStr, weekEnd)
		.all<HabitRecord>();

	const all = rows.results;
	const current = all.filter((r) => r.date >= weekStart && r.date <= weekEnd);
	const previous = all.filter((r) => r.date >= pwsStr && r.date <= pweStr);

	const compThis = current.reduce((s, r) => s + r.completed, 0);
	const compPrev = previous.reduce((s, r) => s + r.completed, 0);
	const target = habit.target_count ?? 2;

	return calcWeeklyMomentum(compThis, compPrev, target, all, weekStart);
}

// ─── History & Totals ────────────────────────────────────────────────────────

interface BuildHistoryOpts {
	userId: string;
	dailyHabitsList: Habit[];
	weeklyHabitsList: Habit[];
	days?: number;
	records?: Map<string, HabitRecord>;
	grouped?: Map<string, HabitRecord[]>;
}

export async function momentumHistory(
	userId: string,
	days = 30,
): Promise<{ date: string; momentum: number }[]> {
	return buildMomentumHistory({ userId, dailyHabitsList: [], weeklyHabitsList: [], days });
}

export async function totalMomentum(userId: string): Promise<number> {
	const hist = await momentumHistory(userId, 30);
	return hist.length > 0 ? hist[hist.length - 1]!.momentum : 0;
}

export async function buildMomentumHistory(
	opts: BuildHistoryOpts,
): Promise<{ date: string; momentum: number }[]> {
	const db = getDb();
	const end = new Date();
	const start = new Date();
	start.setDate(end.getDate() - ((opts.days ?? 30) - 1));
	const endStr = formatDate(end);
	const startStr = formatDate(start);

	let daily = opts.dailyHabitsList;
	let weekly = opts.weeklyHabitsList;

	if (daily.length === 0 && weekly.length === 0) {
		const all = await getUserHabits(opts.userId);
		daily = all.filter((h) => h.type === "daily");
		weekly = all.filter((h) => h.type === "weekly");
	}

	const allIds = [...daily, ...weekly].map((h) => h.id);
	if (allIds.length === 0) return [];

	let byDate: Map<string, HabitRecord>;
	let byHabit: Map<string, HabitRecord[]>;

	if (opts.records) {
		byDate = opts.records;
		byHabit = new Map();
		for (const id of allIds) byHabit.set(id, []);
		for (const [, rec] of byDate) byHabit.get(rec.habit_id)?.push(rec);
	} else if (opts.grouped) {
		byHabit = opts.grouped;
		byDate = new Map();
		for (const [, recs] of byHabit) {
			for (const rec of recs) byDate.set(`${rec.habit_id}_${rec.date}`, rec);
		}
	} else {
		const placeholders = buildInPlaceholders(allIds.length);
		const rows = await db
			.prepare(
				`SELECT * FROM habit_records WHERE user_id = ? AND habit_id IN (${placeholders}) ORDER BY date`,
			)
			.bind(opts.userId, ...allIds)
			.all<HabitRecord>();

		byDate = new Map();
		byHabit = new Map();
		for (const id of allIds) byHabit.set(id, []);
		for (const r of rows.results) {
			byDate.set(`${r.habit_id}_${r.date}`, r);
			byHabit.get(r.habit_id)?.push(r);
		}
	}

	const dailyAcc = new Map<string, number>();
	const weeklyAcc = new Map<string, number>();
	// Initialize each daily habit's running momentum to its last record before the window
	// This ensures momentum built up before the 30-day window is reflected in totals
	for (const h of daily) {
		const recs = byHabit.get(h.id) ?? [];
		let lastM = 0;
		for (let i = recs.length - 1; i >= 0; i--) {
			if (recs[i]!.date < startStr) {
				lastM = recs[i]!.momentum;
				break;
			}
		}
		dailyAcc.set(h.id, lastM);
	}
	for (const h of weekly) weeklyAcc.set(h.id, h.accumulated_momentum ?? 0);

	const processedWeeks = new Map<string, Set<string>>();
	for (const h of weekly) processedWeeks.set(h.id, new Set());

	const result: { date: string; momentum: number }[] = [];
	const dates: string[] = [];
	let cur = new Date(start);
	while (cur <= end) {
		dates.push(formatDate(cur));
		cur.setDate(cur.getDate() + 1);
	}

	for (const ds of dates) {
		let dM = 0;

		for (const h of daily) {
			const key = `${h.id}_${ds}`;
			const rec = byDate.get(key);
			if (rec && rec.date >= startStr && rec.date <= endStr) {
				// Update running momentum to the actual record value
				dailyAcc.set(h.id, rec.momentum);
			}
			dM += dailyAcc.get(h.id) ?? 0;
		}

		let wM = 0;
		for (const h of weekly) {
			const week = getWeekRange(new Date(ds));
			const wk = week.start;
			const pw = processedWeeks.get(h.id)!;
			if (!pw.has(wk) && week.start <= endStr && week.end >= startStr) {
				pw.add(wk);
				const hrs = byHabit.get(h.id) ?? [];
				const curRecs = hrs.filter((r) => r.date >= week.start && r.date <= week.end);
				const c = curRecs.reduce((s, r) => s + r.completed, 0);
				const pwe2 = new Date(week.start);
				pwe2.setDate(pwe2.getDate() - 1);
				const pws2 = new Date(pwe2);
				pws2.setDate(pwe2.getDate() - 6);
				const prevRecs = hrs.filter((r) => r.date >= formatDate(pws2) && r.date <= formatDate(pwe2));
				const cp = prevRecs.reduce((s, r) => s + r.completed, 0);
				const tgt = h.target_count ?? 2;

				const wm = calcWeeklyMomentum(c, cp, tgt, hrs, week.start);
				// Replace, don't accumulate — each week's momentum is the independent score
				weeklyAcc.set(h.id, wm);
			}
			wM += weeklyAcc.get(h.id) ?? 0;
		}

		result.push({ date: ds, momentum: dM + wM });
	}

	return result;
}
// ─── Field Mapping ──────────────────────────────────────────────────────────

export interface CamelHabit {
	id: string;
	name: string;
	description: string | null;
	type: string;
	targetCount: number;
	accumulatedMomentum: number;
	createdAt: string | null;
	archivedAt: string | null;
	[key: string]: unknown;
}

export function toCamelHabit(h: Habit): CamelHabit {
	return {
		id: h.id,
		name: h.name,
		description: h.description,
		type: h.type,
		targetCount: h.target_count ?? 1,
		accumulatedMomentum: h.accumulated_momentum ?? 0,
		createdAt: h.created_at,
		archivedAt: h.archived_at,
	};
}

export function toCamelRecord(r: HabitRecord) {
	return {
		id: r.id,
		habitId: r.habit_id,
		userId: r.user_id,
		date: r.date,
		completed: r.completed,
		momentum: r.momentum,
		createdAt: r.created_at,
	};
}
