import { createInertiaApp } from "@inertiajs/react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Layout from "./Layout";

import "./app.css";

createInertiaApp({
	resolve: (name) => {
		const pages = import.meta.glob("./pages/**/*.tsx", { eager: false });
		const pagePath = `./pages/${name}.tsx`;
		const load = pages[pagePath] as () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;

		if (!load) {
			throw new Error(`Page not found: ${name} (${pagePath})`);
		}

		return load().then((mod) => {
			const Component = mod.default;

			if (name === "Login") {
				return Component;
			}

			return (props: Record<string, unknown>) => (
				<Layout>
					<Component {...props} />
				</Layout>
			);
		});
	},
	setup({ el, App, props }) {
		if (el.dataset.hydrated) return;
		el.dataset.hydrated = "true";

		if (el.childNodes.length > 0) {
			hydrateRoot(el, <App {...props} />);
		} else {
			createRoot(el).render(<App {...props} />);
		}
	},
});
