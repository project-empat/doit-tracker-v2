import { Link, Head } from "@inertiajs/react";
import {
	CheckSquare,
	Calendar,
	Smile,
	ArrowRight,
	Target,
	Zap,
	TrendingUp,
} from "lucide-react";

interface SessionUser {
	id: string;
	name?: string;
	email?: string;
	image?: string;
}

interface Props {
	session: { user: SessionUser } | null;
}

export default function Home({ session }: Props) {
	return (
		<>
			<Head title="DoIt Tracker - A guilt-free habit tracker" />
			<div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-primary/5 to-base-200">
				{/* Hero */}
				<section className="px-4 pt-20 pb-16 max-w-6xl mx-auto text-center">
					<h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-base-content">
						<span className="block">DoIt Tracker</span>
						<span className="block text-primary mt-2">
							A guilt-free way to build habits
						</span>
					</h1>
					<p className="mt-6 text-xl text-base-content/60 max-w-3xl mx-auto">
						Focus on progress, not perfection. Build lasting habits with a
						momentum system that rewards consistency and forgives occasional
						misses.
					</p>
					<div className="mt-10 flex justify-center gap-3">
						{session ? (
							<Link
								href="/dashboard"
								className="btn btn-primary btn-lg gap-2"
							>
								Go to Dashboard
								<ArrowRight size={20} />
							</Link>
						) : (
							<Link href="/login" className="btn btn-primary btn-lg gap-2">
								Get Started
								<ArrowRight size={20} />
							</Link>
						)}
						<a
							href="#features"
							className="btn btn-outline btn-lg"
						>
							Learn more
						</a>
					</div>
				</section>

				{/* Features */}
				<section id="features" className="px-4 py-16 max-w-6xl mx-auto">
					<h2 className="text-3xl font-extrabold text-center mb-12 text-base-content">
						Key Features
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="card bg-base-100 shadow-md border border-base-200">
							<div className="card-body">
								<div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-2">
									<CheckSquare className="text-primary" size={24} />
								</div>
								<h3 className="card-title">Daily Habits</h3>
								<p className="text-base-content/60">
									Build a daily routine with habits that reward consistency.
									Each completion adds to your momentum score.
								</p>
								<ul className="mt-3 space-y-2 text-sm text-base-content/60">
									<li className="flex items-start gap-2">
										<Target className="text-success shrink-0 mt-0.5" size={16} />
										Gain +1 momentum for each completion
									</li>
									<li className="flex items-start gap-2">
										<Zap className="text-success shrink-0 mt-0.5" size={16} />
										Build streaks for bonus momentum
									</li>
									<li className="flex items-start gap-2">
										<TrendingUp className="text-success shrink-0 mt-0.5" size={16} />
										Maximum +30 momentum per habit
									</li>
								</ul>
							</div>
						</div>

						<div className="card bg-base-100 shadow-md border border-base-200">
							<div className="card-body">
								<div className="bg-secondary/10 rounded-full w-12 h-12 flex items-center justify-center mb-2">
									<Calendar className="text-secondary" size={24} />
								</div>
								<h3 className="card-title">Weekly Habits</h3>
								<p className="text-base-content/60">
									Set flexible weekly goals with minimum targets. Perfect for
									habits that don't need to be done every single day.
								</p>
								<ul className="mt-3 space-y-2 text-sm text-base-content/60">
									<li className="flex items-start gap-2">
										<Target className="text-success shrink-0 mt-0.5" size={16} />
										+1 momentum per tracking
									</li>
									<li className="flex items-start gap-2">
										<Zap className="text-success shrink-0 mt-0.5" size={16} />
										+10 bonus when reaching weekly minimum
									</li>
									<li className="flex items-start gap-2">
										<TrendingUp className="text-success shrink-0 mt-0.5" size={16} />
										Up to +40 momentum with consecutive successes
									</li>
								</ul>
							</div>
						</div>

						<div className="card bg-base-100 shadow-md border border-base-200">
							<div className="card-body">
								<div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mb-2">
									<Smile className="text-accent" size={24} />
								</div>
								<h3 className="card-title">Guilt-Free System</h3>
								<p className="text-base-content/60">
									Life happens. Our momentum system encourages consistency
									without punishing the occasional miss too harshly.
								</p>
								<ul className="mt-3 space-y-2 text-sm text-base-content/60">
									<li className="flex items-start gap-2">
										<Target className="text-success shrink-0 mt-0.5" size={16} />
										Focus on overall progress, not perfection
									</li>
									<li className="flex items-start gap-2">
										<Zap className="text-success shrink-0 mt-0.5" size={16} />
										Reasonable penalties for missed habits
									</li>
									<li className="flex items-start gap-2">
										<TrendingUp className="text-success shrink-0 mt-0.5" size={16} />
										Quick recovery from occasional setbacks
									</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* How It Works */}
				<section className="px-4 py-16 max-w-6xl mx-auto">
					<h2 className="text-3xl font-extrabold text-center mb-12 text-base-content">
						How It Works
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="text-center">
							<div className="bg-primary text-primary-content rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg">
								1
							</div>
							<h3 className="text-xl font-semibold mb-2">Create Your Habits</h3>
							<p className="text-base-content/60">
								Choose between daily or weekly habits and set your goals.
							</p>
						</div>
						<div className="text-center">
							<div className="bg-primary text-primary-content rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg">
								2
							</div>
							<h3 className="text-xl font-semibold mb-2">Track Consistently</h3>
							<p className="text-base-content/60">
								Check in regularly to mark your habits as complete.
							</p>
						</div>
						<div className="text-center">
							<div className="bg-primary text-primary-content rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg">
								3
							</div>
							<h3 className="text-xl font-semibold mb-2">Build Momentum</h3>
							<p className="text-base-content/60">
								Watch your momentum score grow as you develop lasting habits.
							</p>
						</div>
					</div>
					{!session && (
						<div className="text-center mt-12">
							<Link href="/login" className="btn btn-primary btn-lg gap-2">
								Start Building Better Habits
								<ArrowRight size={20} />
							</Link>
						</div>
					)}
				</section>
			</div>
		</>
	);
}
