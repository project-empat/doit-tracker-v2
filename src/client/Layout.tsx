import { Link, usePage } from "@inertiajs/react";
import {
	CheckSquare,
	Calendar,
	LayoutDashboard,
	Menu,
	X,
	LogOut,
} from "lucide-react";
import { useState } from "react";

interface SessionUser {
	id: string;
	name?: string;
	email?: string;
	image?: string;
}

interface PageProps {
	session?: { user: SessionUser } | null;
	[key: string]: unknown;
}

export default function Layout({ children }: { children: React.ReactNode }) {
	const { props } = usePage<PageProps>();
	const session = props.session;
	const [drawerOpen, setDrawerOpen] = useState(false);

	const navLinks = [
		{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
		{ href: "/habits/daily", label: "Daily Habits", icon: CheckSquare },
		{ href: "/habits/weekly", label: "Weekly Habits", icon: Calendar },
	];

	return (
		<div className="flex min-h-screen flex-col">
			{/* Navbar */}
			<header className="navbar bg-base-100 border-b border-base-300 shadow-sm">
				<div className="navbar-start">
					{session && (
						<button
							className="btn btn-ghost btn-sm lg:hidden"
							onClick={() => setDrawerOpen(!drawerOpen)}
							aria-label="Toggle menu"
						>
							{drawerOpen ? <X size={20} /> : <Menu size={20} />}
						</button>
					)}
					<Link href="/" className="btn btn-ghost text-xl font-bold text-primary">
						DoIt Tracker
					</Link>
				</div>

				{session && (
					<>
						<div className="navbar-center hidden lg:flex">
							<ul className="menu menu-horizontal px-1 gap-1">
								{navLinks.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											className="flex items-center gap-2 text-sm font-medium"
										>
											<link.icon size={16} />
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>

						<div className="navbar-end">
							<div className="dropdown dropdown-end">
								<div
									tabIndex={0}
									role="button"
									className="btn btn-ghost btn-circle avatar"
								>
									{session.user?.image ? (
										<div className="w-8 h-8 rounded-full overflow-hidden">
											<img
												src={session.user.image}
												alt={session.user.name ?? "User"}
												className="w-full h-full object-cover"
											/>
										</div>
									) : (
										<div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold">
											{(session.user?.name ?? "U").charAt(0).toUpperCase()}
										</div>
									)}
								</div>
								<ul
									tabIndex={0}
									className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-200"
								>
									<li className="menu-title">
										<span>{session.user?.name ?? "User"}</span>
									</li>
									<li>
										<a href="/auth/signout" className="flex items-center gap-2 text-error">
											<LogOut size={16} />
											Sign Out
										</a>
									</li>
								</ul>
							</div>
						</div>
					</>
				)}
			</header>

			{/* Mobile drawer */}
			{session && drawerOpen && (
				<div className="lg:hidden border-b border-base-300 bg-base-200">
					<ul className="menu p-4">
						{navLinks.map((link) => (
							<li key={link.href}>
								<Link
									href={link.href}
									className="flex items-center gap-2"
									onClick={() => setDrawerOpen(false)}
								>
									<link.icon size={18} />
									{link.label}
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Main content */}
			<main className="flex-1 bg-base-200">
				<div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
					{children}
				</div>
			</main>

			{/* Footer */}
			<footer className="footer footer-center bg-base-100 border-t border-base-300 p-4 text-base-content/60 text-sm">
				<div className="flex gap-4">
					<Link href="/privacy" className="link link-hover">Privacy</Link>
					<Link href="/terms" className="link link-hover">Terms</Link>
					<span>&copy; {new Date().getFullYear()} DoIt Tracker</span>
				</div>
			</footer>
		</div>
	);
}
