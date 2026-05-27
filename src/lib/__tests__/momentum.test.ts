import { describe, it, expect } from "vitest";
import {
	calcDailyMomentum,
	calcWeeklyMomentum,
	formatDate,
	getWeekRange,
} from "../habits";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rec(date: string, momentum: number, completed = 1) {
	return {
		id: "test",
		habit_id: "test-habit",
		user_id: "test-user",
		date,
		completed,
		momentum,
		created_at: new Date().toISOString(),
	};
}

// ─── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
	it("formats a date as YYYY-MM-DD", () => {
		expect(formatDate(new Date("2026-05-27"))).toBe("2026-05-27");
	});

	it("zero-pads month and day", () => {
		expect(formatDate(new Date("2026-01-03"))).toBe("2026-01-03");
	});
});

// ─── getWeekRange ────────────────────────────────────────────────────────────

describe("getWeekRange", () => {
	it("returns Monday-to-Sunday for a Wednesday", () => {
		// 2026-05-27 is a Wednesday
		const { start, end } = getWeekRange(new Date("2026-05-27"));
		expect(start).toBe("2026-05-25"); // Monday
		expect(end).toBe("2026-05-31"); // Sunday
	});

	it("returns Monday-to-Sunday for a Sunday", () => {
		// 2026-05-31 is a Sunday
		const { start, end } = getWeekRange(new Date("2026-05-31"));
		expect(start).toBe("2026-05-25"); // Previous Monday
		expect(end).toBe("2026-05-31"); // Sunday
	});

	it("returns Monday-to-Sunday for a Monday", () => {
		const { start, end } = getWeekRange(new Date("2026-05-25"));
		expect(start).toBe("2026-05-25");
		expect(end).toBe("2026-05-31");
	});
});

// ─── calcDailyMomentum ───────────────────────────────────────────────────────
//
// Rules:
//   completed=1, no prev          → +1
//   completed=1, prev completed   → min(prev.momentum + 1, 7)  [streak]
//   completed=1, prev incomplete  → +1                          [streak broken]
//   completed=1, gap >1 day       → +1                          [reset after miss]
//   completed=0, prev completed   → 0                           [first miss]
//   completed=0, prev incomplete  → max(prev.momentum - 1, -3)  [consecutive miss]
//   completed=0, no prev          → 0

describe("calcDailyMomentum", () => {
	it("returns +1 when completed with no previous record", () => {
		expect(calcDailyMomentum(1, undefined, "2026-05-27")).toBe(1);
	});

	describe("streak (completed today, prev completed)", () => {
		it("increments momentum by +1", () => {
			expect(calcDailyMomentum(1, rec("2026-05-26", 3, 1), "2026-05-27")).toBe(4);
		});

		it("caps at +7", () => {
			expect(calcDailyMomentum(1, rec("2026-05-26", 7, 1), "2026-05-27")).toBe(7);
			expect(calcDailyMomentum(1, rec("2026-05-26", 10, 1), "2026-05-27")).toBe(7);
		});

		it("builds streak from 1", () => {
			expect(calcDailyMomentum(1, rec("2026-05-26", 1, 1), "2026-05-27")).toBe(2);
		});
	});

	describe("streak broken (completed today, prev not completed)", () => {
		it("returns +1 regardless of previous momentum", () => {
			expect(calcDailyMomentum(1, rec("2026-05-26", 5, 0), "2026-05-27")).toBe(1);
		});

		it("returns +1 when prev has negative momentum", () => {
			expect(calcDailyMomentum(1, rec("2026-05-26", -3, 0), "2026-05-27")).toBe(1);
		});
	});

	describe("first miss (not completed, prev completed)", () => {
		it("resets positive momentum to 0", () => {
			expect(calcDailyMomentum(0, rec("2026-05-26", 5, 1), "2026-05-27")).toBe(0);
		});

		it("resets from 1 to 0", () => {
			expect(calcDailyMomentum(0, rec("2026-05-26", 1, 1), "2026-05-27")).toBe(0);
		});
	});

	describe("consecutive miss (not completed, prev not completed)", () => {
		it("decrements by 1 from -1", () => {
			expect(calcDailyMomentum(0, rec("2026-05-26", -1, 0), "2026-05-27")).toBe(-2);
		});

		it("decrements by 1 from -2", () => {
			expect(calcDailyMomentum(0, rec("2026-05-26", -2, 0), "2026-05-27")).toBe(-3);
		});

		it("caps at -3 (does not go below -3)", () => {
			expect(calcDailyMomentum(0, rec("2026-05-26", -3, 0), "2026-05-27")).toBe(-3);
			expect(calcDailyMomentum(0, rec("2026-05-26", -5, 0), "2026-05-27")).toBe(-3);
		});
	});

	describe("not completed, no previous record", () => {
		it("returns 0", () => {
			expect(calcDailyMomentum(0, undefined, "2026-05-27")).toBe(0);
		});
	});

	describe("momentum boundaries", () => {
		it("stays within [-3, +7] range after many completions", () => {
			let m = 0;
			const prev = rec("2026-05-26", m, 1);
			// 10 consecutive completions
			for (let i = 0; i < 10; i++) {
				m = calcDailyMomentum(1, rec("2026-05-26", m, 1), "2026-05-27");
			}
			expect(m).toBeLessThanOrEqual(7);
		});

		it("stays within [-3, +7] range after many misses", () => {
			let m = -1;
			for (let i = 0; i < 10; i++) {
				m = calcDailyMomentum(0, rec("2026-05-26", m, 0), "2026-05-27");
			}
			expect(m).toBeGreaterThanOrEqual(-3);
		});
	});
});

// ─── calcWeeklyMomentum ──────────────────────────────────────────────────────
//
// Rules:
//   target met                 → completions + 10
//   target met, prev also met  → completions + 20  (cap 40)
//   target not met, 1st miss   → completions       (no penalty)
//   2nd consecutive miss       → completions - 10
//   3rd consecutive miss       → completions - 20
//   4th+ consecutive miss      → completions - 30

describe("calcWeeklyMomentum", () => {
	const targetCount = 3;
	const wkStart = "2026-05-25";

	it("returns completions when target not met (first miss)", () => {
		const result = calcWeeklyMomentum(1, 3, targetCount, [], wkStart);
		expect(result).toBe(1); // 1 completion, no penalty on first miss
	});

	it("adds +10 bonus when target met (no consecutive bonus if prev week missed)", () => {
		const result = calcWeeklyMomentum(3, 1, targetCount, [], wkStart);
		expect(result).toBe(13); // 3 completions + 10 target bonus
	});

	it("adds +10 target bonus and +10 consecutive bonus when both weeks met target", () => {
		const result = calcWeeklyMomentum(3, 3, targetCount, [], wkStart);
		expect(result).toBe(23); // 3 completions + 10 target bonus + 10 consecutive bonus
	});

	it("adds +20 bonus when target met consecutively", () => {
		const result = calcWeeklyMomentum(5, 4, targetCount, [], wkStart);
		expect(result).toBe(25); // 5 completions + 20 (cap 40)
	});

	it("caps consecutive bonus at 40", () => {
		const result = calcWeeklyMomentum(30, 30, targetCount, [], wkStart);
		expect(result).toBe(40);
	});

	describe("consecutive miss penalties", () => {
		it("applies -10 penalty on 2nd consecutive miss", () => {
			// prev week was also a miss (targetCount not met),
			// prev completion count = 1, prev momentum matched that → penalty of 0 means 1st miss was clean
			// That means this is 2nd miss → -10
			const prevRecs = [rec("2026-05-18", 1, 1)]; // prev week: 1 completion, momentum=1 (no penalty applied)
			const result = calcWeeklyMomentum(1, 1, targetCount, prevRecs, wkStart);
			expect(result).toBe(-9); // 1 - 10
		});

		it("applies -20 penalty on 3rd consecutive miss", () => {
			// prev week momentum=1, completionsPrev=1 → penalty = 1-1 = 0 → means 1st miss
			// So prev week was 2nd consecutive miss (penalty -10)
			// That means this is 3rd miss → -20
			const prevRecs = [
				rec("2026-05-11", -9, 1), // 2 weeks ago: momentum = -9 (1-10)
				rec("2026-05-18", -9, 1), // last week: momentum = -9
			];
			const result = calcWeeklyMomentum(1, 1, targetCount, prevRecs, wkStart);
			expect(result).toBe(-19); // 1 - 20
		});

		it("applies -30 penalty on 4th+ consecutive miss", () => {
			const prevRecs = [
				rec("2026-05-04", -19, 1),
				rec("2026-05-11", -19, 1),
				rec("2026-05-18", -19, 1),
			];
			const result = calcWeeklyMomentum(1, 1, targetCount, prevRecs, wkStart);
			expect(result).toBe(-29); // 1 - 30
		});
	});

	describe("edge cases", () => {

		it("handles zero completions, first miss", () => {
			const result = calcWeeklyMomentum(0, 5, targetCount, [], wkStart);
			expect(result).toBe(0);
		});

		it("handles zero completions, consecutive miss", () => {
			const prevRecs = [rec("2026-05-18", 0, 1)]; // prev week was also 0 completions, no penalty = 1st miss
			const result = calcWeeklyMomentum(0, 0, targetCount, prevRecs, wkStart);
			expect(result).toBe(-10);
		});
	});
});
