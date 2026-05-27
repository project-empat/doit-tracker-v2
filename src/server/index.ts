import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { rootView } from "./root-view";
import { handleAuth } from "./auth";
import { initializeDb } from "../db";
import { processDailyMissed, processWeeklyMissed } from "../cron/handler";
import pages from "./routes/pages";
import api from "./routes/api";

type Env = {
	Bindings: {
		DB: D1Database;
		AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
	};
};

const app = new Hono<Env>();

// Inertia middleware for all page routes
app.use(inertia({ version: "1", rootView }));

// Auth routes
app.all("/auth/:action", (c) => handleAuth(c));

// API routes
app.route("/api", api);

// Page routes
app.route("/", pages);

export default {
	fetch: app.fetch,

	async scheduled(_event: ScheduledEvent, env: Env["Bindings"], _ctx: ExecutionContext) {
		initializeDb({ DB: env.DB });

		console.log("[CRON] Processing daily missed habits...");
		const dailyResult = await processDailyMissed();
		console.log(`[CRON] Daily: ${dailyResult.processed} processed, ${dailyResult.errors} errors`);

		console.log("[CRON] Processing weekly missed habits...");
		const weeklyResult = await processWeeklyMissed();
		console.log(`[CRON] Weekly: ${weeklyResult.processed} processed, ${weeklyResult.errors} errors`);

		console.log("[CRON] Completed.");
	},
};
