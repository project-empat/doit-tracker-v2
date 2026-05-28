import { Head, router } from "@inertiajs/react";
import { useState } from "react";
import {
	Plus,
	X,
	Archive,
	Zap,
	CheckCircle2,
	TrendingUp,
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
	type: "daily";
	targetCount: number;
	accumulatedMomentum: number | null;
	createdAt: string;
	todayRecord?: HabitRecord | null;
	currentMomentum?: number;
	momentumHistory: { date: string; momentum: number | null }[];
}

interface Props {
	habits: Habit[];
}

export default function DailyHabits({ habits }: Props) {
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		try {
			const res = await apiPost("/api/habits/create", {
				name: name.trim(),
				description: description.trim() || null,
				type: "daily",
			});
			if ((res as Record<string, unknown>).success) {
				setShowCreate(false);
				setName("");
				setDescription("");
				setError("");
				router.reload();
			} else {
				setError(String((res as Record<string, unknown>).error ?? "Failed"));
			}
		} catch (err) {
			setError(String(err));
		}
	};

	const handleTrack = async (habitId: string) => {
		await apiPost("/api/habits/track", { habitId });
		router.reload();
	};

	const handleArchive = async (habitId: string) => {
		if (!confirm("Archive this habit? It will be hidden from view.")) return;
		await apiPost("/api/habits/archive", { habitId });
		router.reload();
	};

	return (
		<>
			<Head title="Daily Habits - DoIt Tracker" />
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">Daily Habits</h1>
						<p className="text-sm text-base-content/60 mt-1">{today}</p>
					</div>
					<button
						onClick={() => setShowCreate(!showCreate)}
						className={`btn ${showCreate ? "btn-ghost" : "btn-primary"} gap-2`}
					>
						{showCreate ? <X size={18} /> : <Plus size={18} />}
						{showCreate ? "Cancel" : "Create New Habit"}
					</button>
				</div>

				{/* Create Form */}
				{showCreate && (
					<div className="card bg-base-100 shadow-md border border-base-200">
						<div className="card-body">
							<h2 className="card-title">Create New Daily Habit</h2>
							<form onSubmit={handleCreate} className="space-y-4">
								{error && <div className="alert alert-error">{error}</div>}
								<fieldset className="fieldset">
									<legend className="fieldset-legend">Habit Name</legend>
									<input
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="e.g., Morning meditation"
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
								<div className="flex justify-end">
									<button type="submit" className="btn btn-primary gap-2">
										<Plus size={18} /> Create Habit
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Habit List */}
				{habits.length === 0 ? (
					<div className="card bg-base-100 shadow-md border border-base-200">
						<div className="card-body text-center py-12">
							<TrendingUp size={48} className="mx-auto text-base-content/20 mb-4" />
							<p className="text-base-content/60">
								You don't have any daily habits yet. Create your first one!
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-4">
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
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<span className="badge badge-outline badge-lg">
												{habit.accumulatedMomentum ?? 0}
											</span>
											{habit.todayRecord?.completed ? (
												<button
													disabled
													className="btn btn-success btn-sm gap-1"
												>
													<CheckCircle2 size={16} /> Done
												</button>
											) : (
												<button
													onClick={() => handleTrack(habit.id)}
													className="btn btn-primary btn-sm gap-1"
												>
													<Zap size={16} /> Track
												</button>
											)}
										</div>
									</div>

									{/* Momentum mini chart */}
									{habit.momentumHistory && habit.momentumHistory.length > 0 && (
										<div className="mt-4">
											<MomentumChart data={habit.momentumHistory} height={80} compact />
										</div>
									)}

									{/* Current momentum */}
									<div className="flex items-center gap-4 mt-2 text-sm">
										<span className="text-base-content/60">
											Current momentum:{" "}
											<span className="font-semibold">
												{habit.currentMomentum ?? 0}
											</span>
										</span>
										<button
											onClick={() => handleArchive(habit.id)}
											className="btn btn-ghost btn-xs text-base-content/40 hover:text-error gap-1 ml-auto"
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
