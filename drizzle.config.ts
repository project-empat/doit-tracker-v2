import type { Config } from "drizzle-kit";

export default {
	schema: "./src/db/schema.ts",
	out: "./src/db",
	dialect: "sqlite",
	driver: "d1",
} satisfies Config;
