import { Head, router } from "@inertiajs/react";
import { useState } from "react";
import {
	Plus,
	X,
	Archive,
	CheckCircle2,
	Target,
	TrendingUp,
	CalendarDays,
} from "lucide-react";
import MomentumChart from "../MomentumChart";
import { apiPost } from "../api";

interface HabitRecord {
	id: string;
	date: string;
	completed: number;
	momentum: number;
}

interface Habit {
	id: string;
	name: string;
	description: string | null;
	type: "weekly";
	targetCount: number;
	accumulatedMomentum: number | null;
	createdAt: string;
	weekRecords: HabitRecord[];
	completionsThisWeek: number;
	targetMet: boolean;
	currentMomentum: number;
	momentumHistory: { date: string; momentum: number }[];
}

interface Props {
	habits: Habit[];
	currentWeek: { start: string; end: string };
}

export default function WeeklyHabits({ habits, currentWeek }: Props) {
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [targetCount, setTargetCount] = useState(2);
	const [error, setError] = useState("");

	const weekStr = new Date(currentWeek.start).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
	const weekEndStr = new Date(currentWeek.end).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});

	const daysOfWeek = getDays(currentWeek.start, currentWeek.end);

	const handleCreate = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		(async () => {
			try {
				const res = await apiPost("/api/habits/create", {
				name: name.trim(),
				description: description.trim() || null,
				type: "weekly",
				targetCount: Math.max(2, targetCount),
				});
				if ((res as Record<string, unknown>).success) {
					setShowCreate(false);
					setName("");
					setDescription("");
					setTargetCount(2);
					setError("");
					router.reload();
				} else {
					setError(String((res as Record<string, unknown>).error ?? "Failed"));
				}
			} catch (err) {
				setError(String(err));
			}
		})();
	};

	const handleTrack = async (habitId: string, date: string) => {
		await apiPost("/api/habits/track", { habitId, date });
					router.reload();
	};

	const handleArchive = async (habitId: string) => {
		if (!confirm("Archive this habit? It will be hidden from view.")) return;
		await apiPost("/api/habits/archive", { habitId });
					router.reload();
	};

	const isCompletedOnDate = (habit: Habit, dateStr: string) => {
		const std = dateStr.split("T")[0]!;
		return habit.weekRecords?.some(
			(r) => r.date.split("T")[0] === std && r.completed > 0,
		);
	};

	return (
		<>
			<Head title="Weekly Habits - DoIt Tracker" />
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">Weekly Habits</h1>
						<p className="text-sm text-base-content/60 mt-1 flex items-center gap-1">
							<CalendarDays size={14} />
							Week of {weekStr} &mdash; {weekEndStr}
						</p>
					</div>
					<button
						onClick={() => setShowCreate(!showCreate)}
						className={`btn ${showCreate ? "btn-ghost" : "btn-secondary"} gap-2`}
					>
						{showCreate ? <X size={18} /> : <Plus size={18} />}
						{showCreate ? "Cancel" : "Create New Habit"}
					</button>
				</div>

				{/* Create Form */}
				{showCreate && (
					<div className="card bg-base-100 shadow-md border border-base-200">
						<div className="card-body">
							<h2 className="card-title">Create New Weekly Habit</h2>
							<form onSubmit={handleCreate} className="space-y-4">
								{error && <div className="alert alert-error">{error}</div>}
								<fieldset className="fieldset">
									<legend className="fieldset-legend">Habit Name</legend>
									<input
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="e.g., Weekly exercise"
										className="input input-bordered w-full"
										required
									/>
								</fieldset>
								<fieldset className="fieldset">
									<legend className="fieldset-legend">Description (Optional)</legend>
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Why do you want to build this habit?"
										className="textarea textarea-bordered w-full"
										rows={3}
									/>
								</fieldset>
								<fieldset className="fieldset">
									<legend className="fieldset-legend">Minimum times per week</legend>
									<input
										type="number"
										value={targetCount}
										onChange={(e) => setTargetCount(Number(e.target.value))}
										min={2}
										max={7}
										className="input input-bordered w-24"
									/>
								</fieldset>
								<div className="flex justify-end">
									<button type="submit" className="btn btn-secondary gap-2">
										<Plus size={18} /> Create Habit
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Habits */}
				{habits.length === 0 ? (
					<div className="card bg-base-100 shadow-md border border-base-200">
						<div className="card-body text-center py-12">
							<TrendingUp size={48} className="mx-auto text-base-content/20 mb-4" />
							<p className="text-base-content/60">
								You haven't created any weekly habits yet.
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-6">
						{habits.map((habit) => (
							<div
								key={habit.id}
								className="card bg-base-100 shadow-md border border-base-200"
							>
								<div className="card-body">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0">
											<h3 className="card-title text-lg">{habit.name}</h3>
											{habit.description && (
												<p className="text-sm text-base-content/60 mt-1">
													{habit.description}
												</p>
											)}
											<div className="flex items-center gap-3 mt-2">
												<span className="text-sm text-base-content/60">
													Progress:{" "}
													<span className="font-semibold">
														{habit.completionsThisWeek}/{habit.targetCount}
													</span>
												</span>
												<span className="text-sm text-base-content/60">
													Momentum:{" "}
													<span className="font-semibold">
														{habit.currentMomentum}
													</span>
												</span>
												<span className="text-sm text-base-content/60">
													Accumulated:{" "}
													<span className="font-semibold">
														{habit.accumulatedMomentum ?? 0}
													</span>
												</span>
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											{habit.targetMet ? (
												<span className="badge badge-success gap-1">
													<CheckCircle2 size={14} /> Target met
												</span>
											) : (
												<span className="badge badge-warning gap-1">
													<Target size={14} /> In progress
												</span>
											)}
										</div>
									</div>

									{/* Progress bar */}
									<div className="w-full h-2 bg-base-300 rounded-full overflow-hidden mt-4">
										<div
											className={`h-full rounded-full transition-all duration-300 ${
												habit.targetMet ? "bg-success" : "bg-warning"
											}`}
											style={{
												width: `${Math.min(100, (habit.completionsThisWeek / habit.targetCount) * 100)}%`,
											}}
										/>
									</div>

									{/* Weekly calendar days */}
									<div className="flex gap-2 mt-4 overflow-x-auto">
										{daysOfWeek.map((d) => {
											const ds = formatDate(d);
											const completed = isCompletedOnDate(habit, ds);
											return (
												<button
													key={ds}
													onClick={() => handleTrack(habit.id, ds)}
													className={`flex flex-col items-center p-2 rounded-lg border min-w-[56px] transition-all ${
														completed
															? "bg-success/10 border-success text-success"
															: "bg-base-200 border-base-300 hover:border-secondary text-base-content/60"
													}`}
												>
													<span className="text-xs font-medium">
														{d.toLocaleDateString("en-US", { weekday: "short" })}
													</span>
													<span className="text-sm font-bold">
														{d.getDate()}
													</span>
													{completed && <CheckCircle2 size={14} />}
												</button>
											);
										})}
									</div>

									{/* Momentum chart */}
									{habit.momentumHistory && habit.momentumHistory.length > 0 && (
										<div className="mt-4">
											<MomentumChart
												data={habit.momentumHistory}
												height={80}
												compact
											/>
										</div>
									)}

									<div className="flex justify-end mt-2">
										<button
											onClick={() => handleArchive(habit.id)}
											className="btn btn-ghost btn-xs text-base-content/40 hover:text-error gap-1"
										>
											<Archive size={14} /> Archive
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}

function getDays(start: string, end: string): Date[] {
	const days: Date[] = [];
	const cur = new Date(start);
	const endDate = new Date(end);
	while (cur <= endDate) {
		days.push(new Date(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return days;
}

function formatDate(d: Date): string {
	return d.toISOString().split("T")[0]!;
}
