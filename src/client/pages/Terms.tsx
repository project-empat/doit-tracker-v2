import { Head } from "@inertiajs/react";

export default function Terms() {
	return (
		<>
			<Head title="Terms of Service - DoIt Tracker" />
			<div className="max-w-3xl mx-auto prose prose-gray">
				<h1>Terms of Service</h1>
				<p className="lead">Last updated: 2024</p>

				<h2>Acceptance of Terms</h2>
				<p>By using DoIt Tracker, you agree to these terms of service.</p>

				<h2>Service Description</h2>
				<p>DoIt Tracker is a habit tracking application that helps users build and maintain habits through a momentum-based scoring system.</p>

				<h2>User Responsibilities</h2>
				<ul>
					<li>You are responsible for maintaining the confidentiality of your account</li>
					<li>You agree not to misuse the service for any unlawful purpose</li>
					<li>You are responsible for all activity under your account</li>
				</ul>

				<h2>Limitation of Liability</h2>
				<p>DoIt Tracker is provided "as is" without warranty of any kind. We are not liable for any damages arising from the use of this service.</p>

				<h2>Changes to Terms</h2>
				<p>We reserve the right to modify these terms at any time. Users will be notified of material changes.</p>

				<h2>Contact</h2>
				<p>For questions about these terms, please contact the site administrator.</p>
			</div>
		</>
	);
}
