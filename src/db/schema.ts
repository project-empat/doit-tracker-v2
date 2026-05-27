export interface User {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	created_at: string | null;
}

export interface Habit {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	type: "daily" | "weekly";
	target_count: number | null;
	accumulated_momentum: number | null;
	created_at: string | null;
	archived_at: string | null;
}

export interface HabitRecord {
	id: string;
	habit_id: string;
	user_id: string;
	date: string;
	completed: number;
	momentum: number;
	created_at: string | null;
}
