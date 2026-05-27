import { Head } from "@inertiajs/react";
import { Chrome, ArrowRight } from "lucide-react";

export default function Login() {
	return (
		<>
			<Head title="Sign in - DoIt Tracker" />
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-base-200 px-4">
				<div className="card bg-base-100 shadow-xl border border-base-200 w-full max-w-md">
					<div className="card-body p-8 text-center">
						<div className="mb-6">
							<h1 className="text-3xl font-bold text-primary">DoIt Tracker</h1>
							<p className="text-base-content/60 mt-2">
								Sign in to start tracking your habits
							</p>
						</div>

						<div className="space-y-4">
							<a
								href="/auth/signin"
								className="btn btn-outline btn-block gap-3 h-12"
							>
								<Chrome size={22} />
								Sign in with Google
								<ArrowRight size={18} />
							</a>
						</div>

						<p className="text-xs text-base-content/40 mt-6">
							By signing in, you agree to our{" "}
							<a href="/terms" className="link link-hover">
								Terms of Service
							</a>{" "}
							and{" "}
							<a href="/privacy" className="link link-hover">
								Privacy Policy
							</a>
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
