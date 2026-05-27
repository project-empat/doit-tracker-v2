import { getDb } from "../db";
import type { Habit, HabitRecord } from "../db/schema";
import { formatDate, createOrUpdateRecord, weeklyMomentum } from "../lib/habits";

export async function processDailyMissed(): Promise<{ processed: number; errors: number }> {
	const db = getDb();
	let processed = 0;
	let errors = 0;

	try {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yStr = formatDate(yesterday);

		const dailyHabits = await db
			.prepare("SELECT id AS habit_id, user_id, name AS habit_name FROM habits WHERE type = ? AND archived_at IS NULL")
			.bind("daily")
			.all<{ habit_id: string; user_id: string; habit_name: string }>();

		for (const h of dailyHabits.results) {
			try {
				const existing = await db
					.prepare("SELECT id FROM habit_records WHERE habit_id = ? AND date = ? LIMIT 1")
					.bind(h.habit_id, yStr)
					.first();

				if (!existing) {
					const prev = await db
						.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date < ? ORDER BY date DESC LIMIT 1")
						.bind(h.habit_id, yStr)
						.first<HabitRecord>();

					let momentum = 0;
					if (prev) {
						momentum = prev.momentum > 0 ? 0 : Math.max(prev.momentum - 1, -3);
					}

					await createOrUpdateRecord({
						habitId: h.habit_id,
						userId: h.user_id,
						date: yStr,
						completed: 0,
						momentum,
					});
					processed++;
				}
			} catch (e) {
				console.error(`Error processing daily habit ${h.habit_id}:`, e);
				errors++;
			}
		}
	} catch (e) {
		console.error("Error in processDailyMissed:", e);
		throw e;
	}

	return { processed, errors };
}

export async function processWeeklyMissed(): Promise<{ processed: number; errors: number }> {
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
			.prepare("SELECT * FROM habits WHERE type = ? AND archived_at IS NULL")
			.bind("weekly")
			.all<Habit>();

		for (const h of weeklyHabits.results) {
			try {
				const weekRecords = await db
					.prepare("SELECT * FROM habit_records WHERE habit_id = ? AND date >= ? AND date <= ?")
					.bind(h.id, ws, we)
					.all<HabitRecord>();

				const totalComp = weekRecords.results.reduce((s, r) => s + r.completed, 0);
				const wm = await weeklyMomentum(h, h.user_id, ws, we);
				const currentAcc = h.accumulated_momentum ?? 0;

				await db
					.prepare("UPDATE habits SET accumulated_momentum = ? WHERE id = ?")
					.bind(currentAcc + wm, h.id)
					.run();

				if (totalComp < (h.target_count ?? 2)) {
					await createOrUpdateRecord({
						habitId: h.id,
						userId: h.user_id,
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
	const cutoff = formatDate(new Date(Date.now() - days * 86400000));
	await db.prepare("DELETE FROM habit_records WHERE date < ?").bind(cutoff).run();
}
