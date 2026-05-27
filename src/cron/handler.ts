import { getDb } from "../db";
import { habits, habitRecords } from "../db/schema";
import { eq, and, sql, lt, gte, lte, desc } from "drizzle-orm";
import { formatDate, createOrUpdateRecord, weeklyMomentum } from "../lib/habits";

export async function processDailyMissed(): Promise<{
	processed: number;
	errors: number;
}> {
	const db = getDb();
	let processed = 0;
	let errors = 0;

	try {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yStr = formatDate(yesterday);

		const dailyHabits = await db
			.select({
				habitId: habits.id,
				userId: habits.userId,
				habitName: habits.name,
			})
			.from(habits)
			.where(and(eq(habits.type, "daily"), sql`${habits.archivedAt} IS NULL`));

		for (const h of dailyHabits) {
			try {
				const existing = await db
					.select()
					.from(habitRecords)
					.where(and(eq(habitRecords.habitId, h.habitId), eq(habitRecords.date, yStr)))
					.limit(1);

				if (existing.length === 0) {
					const prev = await db
						.select()
						.from(habitRecords)
						.where(and(eq(habitRecords.habitId, h.habitId), lt(habitRecords.date, yStr)))
						.orderBy(desc(habitRecords.date))
						.limit(1);

					const last = prev[0];
					let momentum = 0;

					if (last) {
						momentum = last.momentum > 0 ? 0 : Math.max(last.momentum - 1, -3);
					}

					await createOrUpdateRecord({
						habitId: h.habitId,
						userId: h.userId,
						date: yStr,
						completed: 0,
						momentum,
					});
					processed++;
				}
			} catch (e) {
				console.error(`Error processing daily habit ${h.habitId}:`, e);
				errors++;
			}
		}
	} catch (e) {
		console.error("Error in processDailyMissed:", e);
		throw e;
	}

	return { processed, errors };
}

export async function processWeeklyMissed(): Promise<{
	processed: number;
	errors: number;
}> {
	const db = getDb();
	let processed = 0;
	let errors = 0;

	try {
		const today = new Date();
		const lastWeekEnd = new Date(today);
		lastWeekEnd.setDate(today.getDate() - today.getDay());
		if (today.getDay() !== 1) {
			lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
		}
		const lastWeekStart = new Date(lastWeekEnd);
		lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

		const ws = formatDate(lastWeekStart);
		const we = formatDate(lastWeekEnd);

		const weeklyHabits = await db
			.select()
			.from(habits)
			.where(and(eq(habits.type, "weekly"), sql`${habits.archivedAt} IS NULL`));

		for (const h of weeklyHabits) {
			try {
				const weekRecords = await db
					.select()
					.from(habitRecords)
					.where(and(eq(habitRecords.habitId, h.id), gte(habitRecords.date, ws), lte(habitRecords.date, we)));

				const totalComp = weekRecords.reduce((s, r) => s + r.completed, 0);
				const wm = await weeklyMomentum(h, h.userId, ws, we);
				const currentAcc = h.accumulatedMomentum ?? 0;

				await db
					.update(habits)
					.set({ accumulatedMomentum: currentAcc + wm })
					.where(eq(habits.id, h.id));

				if (totalComp < (h.targetCount ?? 2)) {
					await createOrUpdateRecord({
						habitId: h.id,
						userId: h.userId,
						date: we,
						completed: 0,
						momentum: wm,
					});
				}

				processed++;
			} catch (e) {
				console.error(`Error processing weekly habit ${h.id}:`, e);
				errors++;
			}
		}
	} catch (e) {
		console.error("Error in processWeeklyMissed:", e);
		throw e;
	}

	return { processed, errors };
}

export async function cleanupOldRecords(days = 365): Promise<void> {
	const db = getDb();
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	await db.delete(habitRecords).where(lt(habitRecords.date, formatDate(cutoff)));
}
