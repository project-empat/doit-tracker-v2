import { Link, router } from "@inertiajs/react";
import { Head } from "@inertiajs/react";
import { apiPost } from "../api";
import {
	TrendingUp,
	CheckCircle2,
	AlertCircle,
	Target,
	ArrowRight,
	Loader2,
	Zap,
} from "lucide-react";
import MomentumChart from "../MomentumChart";

interface HabitRecord {
	id: string;
	habitId: string;
	date: string;
	completed: number;
	momentum: number;
}

interface Habit {
	id: string;
	name: string;
	description: string | null;
	type: "daily" | "weekly";
	targetCount: number;
	accumulatedMomentum: number;
	createdAt: string;
	archivedAt: string | null;
	todayRecord?: HabitRecord | null;
	currentMomentum?: number;
	isEffectivelyCompleted?: boolean;
	completionsThisWeek?: number;
	targetMet?: boolean;
}

interface MomentumPoint {
	date: string;
	momentum: number;
}

interface Props {
	user: { name: string; email?: string; image?: string };
	dailyHabits: Habit[];
	weeklyHabits: Habit[];
	totalMomentum: number;
	momentumHistory: MomentumPoint[];
	currentWeek: { start: string; end: string };
}

function momentumColor(n: number) {
	if (n > 100) return "text-success";
	if (n > 50) return "text-success";
	if (n > 20) return "text-success/80";
	if (n > 0) return "text-success/60";
	if (n === 0) return "text-base-content/40";
	if (n > -20) return "text-warning";
	if (n > -50) return "text-warning/80";
	return "text-error";
}

function habitMomentumClass(n: number) {
	if (n > 5) return "text-success";
	if (n > 3) return "text-success/80";
	if (n > 0) return "text-success/60";
	if (n === 0) return "text-base-content/40";
	if (n > -2) return "text-warning";
	if (n > -3) return "text-warning/80";
	return "text-error";
}

export default function Dashboard({
	user,
	dailyHabits,
	weeklyHabits,
	totalMomentum,
	momentumHistory,
	currentWeek,
}: Props) {
	const handleTrack = async (habitId: string) => {
		await apiPost("/api/habits/track", { habitId });
		router.reload();
	};

	return (
		<>
			<Head title="Dashboard - DoIt Tracker" />
			<div className="space-y-6">
				<div className="card bg-base-100 shadow-md border border-base-200">
					<div className="card-body">
						<h1 className="card-title text-2xl">
							Welcome, {user.name}!
						</h1>

						{/* Momentum Score */}
						<div className="mt-4">
							<h2 className="text-lg font-semibold mb-2">Your Momentum Score</h2>
							<div className="bg-base-200 rounded-lg p-6 text-center">
								<p className={`text-5xl font-bold ${momentumColor(totalMomentum)}`}>
									{totalMomentum}
								</p>
								{totalMomentum > 0 && (
									<p className="text-sm text-base-content/60 mt-1">
										Great progress! Keep building those habits.
									</p>
								)}
								{totalMomentum === 0 && (
									<p className="text-sm text-base-content/60 mt-1">
										Start building habits to increase your score.
									</p>
								)}
								{totalMomentum < 0 && (
									<p className="text-sm text-base-content/60 mt-1">
										Time to get back on track with your habits!
									</p>
								)}
							</div>
						</div>

						{/* Momentum History Chart */}
						<div className="mt-6">
							<h2 className="text-lg font-semibold mb-2">Momentum History (30 Days)</h2>
							<div className="bg-base-200 rounded-lg p-4">
								{momentumHistory.length > 0 ? (
									<MomentumChart data={momentumHistory} />
								) : (
									<p className="text-center text-base-content/40 py-10">
										No momentum history available yet.
									</p>
								)}
							</div>
						</div>

						{/* Daily & Weekly Summary */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
							{/* Daily Habits */}
							<div className="bg-primary/5 p-4 rounded-lg">
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-lg font-semibold text-primary">Daily Habits</h3>
								</div>
								{dailyHabits.length === 0 ? (
									<p className="text-base-content/60 py-4 text-center">
										You haven't created any daily habits yet.
									</p>
								) : (
									<div className="space-y-3">
										{dailyHabits.slice(0, 3).map((habit) => (
											<div
												key={habit.id}
												className="bg-base-100 p-3 rounded-md shadow-sm border border-primary/10"
											>
												<div className="flex items-center justify-between">
													<div className="flex-1 min-w-0">
														<p className="font-medium truncate">{habit.name}</p>
														<div className="flex items-center gap-2 mt-1">
													<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${habitMomentumClass(habit.currentMomentum ?? 0)}`}>
														{habit.currentMomentum ?? 0}
															</span>
															<span className="text-xs text-base-content/50">
																{habit.isEffectivelyCompleted ? (
																	<span className="flex items-center gap-1 text-success">
																		<CheckCircle2 size={12} /> Completed today
																	</span>
																) : (
																	"Not completed"
																)}
															</span>
														</div>
													</div>
													{!habit.isEffectivelyCompleted && (
														<button
															onClick={() => handleTrack(habit.id)}
															className="btn btn-primary btn-xs"
														>
															<Zap size={14} /> Track
														</button>
													)}
												</div>
											</div>
										))}
									</div>
								)}
								<Link
									href="/habits/daily"
									className="link link-primary text-sm mt-3 inline-block"
								>
									Manage habits &rarr;
								</Link>
							</div>

							{/* Weekly Habits */}
							<div className="bg-secondary/5 p-4 rounded-lg">
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-lg font-semibold text-secondary">Weekly Habits</h3>
								</div>
								{weeklyHabits.length === 0 ? (
									<p className="text-base-content/60 py-4 text-center">
										You haven't created any weekly habits yet.
									</p>
								) : (
									<div className="space-y-3">
										{weeklyHabits.slice(0, 3).map((habit) => (
											<div
												key={habit.id}
												className="bg-base-100 p-3 rounded-md shadow-sm border border-secondary/10"
											>
												<div className="flex items-center justify-between">
													<div className="flex-1 min-w-0">
														<p className="font-medium truncate">{habit.name}</p>
														<div className="flex items-center gap-2 mt-1">
													<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${habitMomentumClass(habit.currentMomentum ?? 0)}`}>
														{habit.currentMomentum ?? 0}
															</span>
															<span className="text-xs text-base-content/50">
																{habit.completionsThisWeek ?? 0} / {habit.targetCount ?? 2} completed
															</span>
														</div>
													</div>
													{habit.targetMet ? (
														<span className="badge badge-success badge-sm">Target met</span>
													) : (
														<span className="badge badge-warning badge-sm">In progress</span>
													)}
												</div>
												<div className="progress w-full h-1.5 mt-2">
													<div
														className={`progress-bar ${habit.targetMet ? "bg-success" : "bg-warning"}`}
														style={{ width: `${Math.min(100, ((habit.completionsThisWeek ?? 0) / (habit.targetCount ?? 2)) * 100)}%` }}
													/>
												</div>
											</div>
										))}
									</div>
								)}
								<Link
									href="/habits/weekly"
									className="link link-secondary text-sm mt-3 inline-block"
								>
									Manage habits &rarr;
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
