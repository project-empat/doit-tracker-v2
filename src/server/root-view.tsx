import { renderToString } from "react-dom/server";
import { ViteClient, Script, Link } from "vite-ssr-components/react";
import { serializePage, type RootView } from "@hono/inertia";

export const rootView: RootView = (page, c) => {
	const assets = renderToString(
		<>
			<ViteClient />
			<Link rel="stylesheet" href="/src/client/app.css" />
			<Script src="/src/client/main.tsx" />
		</>,
	);

	const title =
		page.component === "Home"
			? "DoIt Tracker - A guilt-free way to build habits"
			: `${page.component} - DoIt Tracker`;

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" href="/public/favicon.png" />
    ${assets}
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`;
};
