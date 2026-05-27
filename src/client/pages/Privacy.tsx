import { Head } from "@inertiajs/react";

export default function Privacy() {
	return (
		<>
			<Head title="Privacy Policy - DoIt Tracker" />
			<div className="max-w-3xl mx-auto prose prose-gray">
				<h1>Privacy Policy</h1>
				<p className="lead">Last updated: 2024</p>

				<h2>Information We Collect</h2>
				<p>We collect information you provide when signing in with Google:</p>
				<ul>
					<li>Your email address</li>
					<li>Your name</li>
					<li>Your profile picture (if available)</li>
				</ul>

				<h2>How We Use Your Information</h2>
				<p>We use this information solely to:</p>
				<ul>
					<li>Create and manage your account</li>
					<li>Display your profile information</li>
					<li>Provide the habit tracking service</li>
				</ul>

				<h2>Data Storage</h2>
				<p>Your data is stored securely using Cloudflare D1 database and is encrypted in transit and at rest.</p>

				<h2>Third-Party Services</h2>
				<p>We use Google OAuth for authentication. Google's privacy policy applies to the initial authentication step.</p>

				<h2>Contact</h2>
				<p>For privacy concerns, please contact the site administrator.</p>
			</div>
		</>
	);
}
