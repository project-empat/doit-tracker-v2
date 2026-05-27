import { getDb } from "../db";
import { habits, habitRecords, users } from "../db/schema";
import { eq, and, sql, desc, gte, lte, lt, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export type Habit = typeof habits.$inferSelect;
export type HabitRecord = typeof habitRecords.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;

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

export async function createHabit(data: NewHabit): Promise<Habit> {
	const db = getDb();
	const result = await db.insert(habits).values(data).returning();
	return result[0]!;
}

export async function getHabit(id: string): Promise<Habit | undefined> {
	const db = getDb();
	const result = await db.select().from(habits).where(eq(habits.id, id)).limit(1);
	return result[0];
}

export async function getUserHabits(userId: string, type?: "daily" | "weekly"): Promise<Habit[]> {
	const db = getDb();
	const conditions = [sql`${habits.archivedAt} IS NULL`, eq(habits.userId, userId)];
	if (type) conditions.push(eq(habits.type, type));
	return db.select().from(habits).where(and(...conditions)).orderBy(habits.createdAt);
}

export async function archiveHabit(id: string): Promise<Habit | undefined> {
	const db = getDb();
	const result = await db
		.update(habits)
		.set({ archivedAt: new Date() })
		.where(eq(habits.id, id))
		.returning();
	return result[0];
}

// ─── Records ─────────────────────────────────────────────────────────────────

export async function getRecord(habitId: string, date: string): Promise<HabitRecord | null> {
	const db = getDb();
	const result = await db
		.select()
		.from(habitRecords)
		.where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, date)))
		.limit(1);
	return result[0] ?? null;
}

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

	let momentumVal = providedMomentum;
	let oldMomentum = 0;

	if (habit.type === "daily") {
		const lastRecord = await db
			.select()
			.from(habitRecords)
			.where(and(eq(habitRecords.habitId, habitId), lt(habitRecords.date, stdDate)))
			.orderBy(desc(habitRecords.date))
			.limit(1);

		const last = lastRecord[0];

		if (last && momentumVal === null) {
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
		} else if (momentumVal === null) {
			momentumVal = completed > 0 ? 1 : 0;
		}
	}

	let record: HabitRecord;

	if (existing) {
		oldMomentum = existing.momentum ?? 0;
		const [r] = await db
			.update(habitRecords)
			.set({ completed, momentum: momentumVal ?? existing.momentum })
			.where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, stdDate)))
			.returning();
		record = r!;
	} else {
		const [r] = await db
			.insert(habitRecords)
			.values({
				id: nanoid(),
				habitId,
				userId,
				date: stdDate,
				completed,
				momentum: momentumVal ?? 0,
				createdAt: new Date(),
			})
			.returning();
		record = r!;
	}

	if (habit.type === "daily") {
		const newMomentum = record.momentum ?? 0;
		const delta = newMomentum - oldMomentum;
		if (delta !== 0) {
			await db
				.update(habits)
				.set({ accumulatedMomentum: (habit.accumulatedMomentum ?? 0) + delta })
				.where(eq(habits.id, habitId));
		}
	}

	return record;
}

// ─── Momentum ────────────────────────────────────────────────────────────────

export async function dailyMomentum(habitId: string, _userId: string, date: string, completed: number): Promise<number> {
	const db = getDb();
	if (completed > 0) {
		const y = new Date(date);
		y.setDate(y.getDate() - 1);
		const prev = await getRecord(habitId, formatDate(y));
		return prev?.completed ? Math.min(prev.momentum + 1, 7) : 1;
	}
	const records = await db
		.select()
		.from(habitRecords)
		.where(and(eq(habitRecords.habitId, habitId), lt(habitRecords.date, date)))
		.orderBy(desc(habitRecords.date))
		.limit(1);
	const prev = records[0];
	return prev ? (prev.momentum < 0 ? Math.max(prev.momentum - 1, -3) : 0) : 0;
}

export async function weeklyMomentum(habit: Habit, userId: string, weekStart: string, weekEnd: string): Promise<number> {
	const db = getDb();
	const pwe = new Date(weekStart);
	pwe.setDate(pwe.getDate() - 1);
	const pws = new Date(pwe);
	pws.setDate(pwe.getDate() - 6);

	const all = await db
		.select()
		.from(habitRecords)
		.where(and(eq(habitRecords.habitId, habit.id), gte(habitRecords.date, formatDate(pws)), lte(habitRecords.date, weekEnd)))
		.orderBy(desc(habitRecords.date));

	const current = all.filter((r) => r.date >= weekStart && r.date <= weekEnd);
	const previous = all.filter((r) => r.date >= formatDate(pws) && r.date <= formatDate(pwe));

	const compThis = current.reduce((s, r) => s + r.completed, 0);
	const compPrev = previous.reduce((s, r) => s + r.completed, 0);
	const target = habit.targetCount ?? 2;
	const curMet = compThis >= target;
	const prevMet = compPrev >= target;

	let m = compThis;

	if (curMet) {
		m += 10;
		if (prevMet) {
			m += 10;
			m = Math.min(m, 40);
		}
	} else if (!prevMet && compPrev >= 0) {
		let misses = 1;
		const before = all.filter((r) => r.date < weekStart).sort((a, b) => b.date.localeCompare(a.date));
		if (before.length > 0) {
			const lm = before[0]!.momentum;
			const penalty = lm - compPrev;
			if (penalty === 0) misses = 2;
			else if (penalty === -10) misses = 3;
			else if (penalty <= -20) misses = 4;
		}
		m += misses === 2 ? -10 : misses === 3 ? -20 : misses >= 4 ? -30 : 0;
	}

	return m;
}

// ─── History & Totals ────────────────────────────────────────────────────────

export async function momentumHistory(userId: string, days = 30): Promise<{ date: string; momentum: number }[]> {
	const db = getDb();
	const end = new Date();
	const start = new Date();
	start.setDate(end.getDate() - (days - 1));
	const endStr = formatDate(end);
	const startStr = formatDate(start);

	const [dailyHabitsList, weeklyHabitsList] = await Promise.all([
		getUserHabits(userId, "daily"),
		getUserHabits(userId, "weekly"),
	]);

	const allIds = [...dailyHabitsList, ...weeklyHabitsList].map((h) => h.id);
	if (allIds.length === 0) return [];

	const allRecords = await db
		.select()
		.from(habitRecords)
		.where(and(eq(habitRecords.userId, userId), inArray(habitRecords.habitId, allIds)))
		.orderBy(habitRecords.date);

	const byDate = new Map<string, HabitRecord>();
	for (const r of allRecords) byDate.set(`${r.habitId}_${r.date}`, r);

	const dailyAcc = new Map<string, number>();
	const weeklyAcc = new Map<string, number>();
	for (const h of dailyHabitsList) dailyAcc.set(h.id, 0);
	for (const h of weeklyHabitsList) weeklyAcc.set(h.id, h.accumulatedMomentum ?? 0);

	const processedWeeks = new Map<string, Set<string>>();
	for (const h of weeklyHabitsList) processedWeeks.set(h.id, new Set());

	const result: { date: string; momentum: number }[] = [];
	const dates: string[] = [];
	let cur = new Date(start);
	while (cur <= end) {
		dates.push(formatDate(cur));
		cur.setDate(cur.getDate() + 1);
	}

	for (const ds of dates) {
		let dM = 0;
		let wM = 0;

		for (const h of dailyHabitsList) {
			const key = `${h.id}_${ds}`;
			const rec = byDate.get(key);
			if (rec && rec.date >= startStr && rec.date <= endStr) {
				const prevKey = `${h.id}_${formatDate(new Date(new Date(ds).getTime() - 86400000))}`;
				const prev = byDate.get(prevKey);
				const oldM = prev?.momentum ?? 0;
				const delta = (rec.momentum ?? 0) - oldM;
				dailyAcc.set(h.id, (dailyAcc.get(h.id) ?? 0) + delta);
			}
			dM += dailyAcc.get(h.id) ?? 0;
		}

		for (const h of weeklyHabitsList) {
			const week = getWeekRange(new Date(ds));
			const wk = week.start;
			const pw = processedWeeks.get(h.id)!;
			if (!pw.has(wk) && week.start <= endStr && week.end >= startStr) {
				pw.add(wk);
				const hrs = allRecords.filter((r) => r.habitId === h.id);
				const curRecs = hrs.filter((r) => r.date >= week.start && r.date <= week.end);
				const c = curRecs.reduce((s, r) => s + r.completed, 0);
				const pwe2 = new Date(week.start);
				pwe2.setDate(pwe2.getDate() - 1);
				const pws2 = new Date(pwe2);
				pws2.setDate(pwe2.getDate() - 6);
				const prevRecs = hrs.filter((r) => r.date >= formatDate(pws2) && r.date <= formatDate(pwe2));
				const cp = prevRecs.reduce((s, r) => s + r.completed, 0);
				const tgt = h.targetCount ?? 2;
				const cm = c >= tgt;
				const pm = cp >= tgt;

				let wm = c;
				if (cm) {
					wm += 10;
					if (pm) { wm += 10; wm = Math.min(wm, 40); }
				} else if (!pm && cp >= 0) {
					const before = hrs.filter((r) => r.date < week.start).sort((a, b) => b.date.localeCompare(a.date));
					let misses = 1;
					if (before.length > 0) {
						const lm = before[0]!.momentum;
						const p = lm - cp;
						if (p === 0) misses = 2;
						else if (p === -10) misses = 3;
						else if (p <= -20) misses = 4;
					}
					wm += misses === 2 ? -10 : misses === 3 ? -20 : misses >= 4 ? -30 : 0;
				}
				weeklyAcc.set(h.id, (weeklyAcc.get(h.id) ?? 0) + wm);
			}
			wM += weeklyAcc.get(h.id) ?? 0;
		}

		result.push({ date: ds, momentum: dM + wM });
	}

	return result;
}

export async function totalMomentum(userId: string): Promise<number> {
	const hist = await momentumHistory(userId, 30);
	return hist.length > 0 ? hist[hist.length - 1]!.momentum : 0;
}

export async function dailyMomentumForDate(habitId: string, userId: string, date: string, completed = 0): Promise<number> {
	if (completed > 0) return dailyMomentum(habitId, userId, date, completed);
	const y = new Date(date);
	y.setDate(y.getDate() - 1);
	const prev = await getRecord(habitId, formatDate(y));
	return prev?.completed ? prev.momentum : dailyMomentum(habitId, userId, date, 0);
}
