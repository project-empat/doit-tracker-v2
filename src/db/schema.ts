import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name"),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`CURRENT_TIMESTAMP`,
	),
});

export const habits = sqliteTable("habits", {
	id: text("id")
		.primaryKey()
		.default(sql`(lower(hex(randomblob(16))))`),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	type: text("type", { enum: ["daily", "weekly"] }).notNull(),
	targetCount: integer("target_count").default(1),
	accumulatedMomentum: integer("accumulated_momentum").default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`CURRENT_TIMESTAMP`,
	),
	archivedAt: integer("archived_at", { mode: "timestamp" }),
});

export const habitRecords = sqliteTable(
	"habit_records",
	{
		id: text("id")
			.primaryKey()
			.default(sql`(lower(hex(randomblob(16))))`),
		habitId: text("habit_id")
			.notNull()
			.references(() => habits.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		completed: integer("completed").notNull().default(0),
		momentum: integer("momentum").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		habitDateIdx: unique("habit_records_habit_date_idx").on(
			table.habitId,
			table.date,
		),
	}),
);
