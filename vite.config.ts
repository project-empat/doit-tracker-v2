import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { inertiaPages } from "@hono/inertia/vite";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
	plugins: [
		inertiaPages({
			pagesDir: "./src/client/pages",
			outFile: "./src/client/pages.gen.ts",
			serverModule: "./src/server/index",
		}),
		tailwindcss(),
		cloudflare(),
		ssrPlugin(),
	],
});
