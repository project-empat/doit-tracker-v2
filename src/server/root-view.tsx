import { getHrefFromManifest, getSrcFromManifest } from "vite-ssr-components/common";
import { ViteClient, Script, Link } from "vite-ssr-components/react";
import { serializePage, type RootView } from "@hono/inertia";

export const rootView: RootView = (page, c) => {
	// Dead code — only exists for vite-ssr-components plugin's AST scanner
	// to discover client entry points during build.
	if (false) {
		<>
			<ViteClient />
			<Link rel="stylesheet" href="/src/client/app.css" />
			<Script src="/src/client/main.tsx" />
		</>;
	}

	const cssHref = getHrefFromManifest({ href: "/src/client/app.css" });
	const jsResolved = getSrcFromManifest({ src: "/src/client/main.tsx" });
	const scriptSrc = jsResolved?.src ?? "/src/client/main.tsx";
	const cssImports = jsResolved?.css ?? [];
	const cssTags = cssHref
		? `\n    <link rel="stylesheet" href="${cssHref}" />`
		: "";
	const scriptTags =
		cssImports
			.map((css: string) => `\n    <link rel="stylesheet" href="${css}" />`)
			.join("") +
		`\n    <script type="module" src="${scriptSrc}"></script>`;

	const title =
		page.component === "Home"
			? "DoIt Tracker - A guilt-free way to build habits"
			: `${page.component} - DoIt Tracker`;

	return `<!DOCTYPE html>
<html lang="en" data-theme="nakamuve">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    ${cssTags}${scriptTags}
  </head>
  <body>
    <script>var t=localStorage.getItem("doit:theme");if(!t){t="nakamuve"}document.documentElement.setAttribute("data-theme",t)</script>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`;
};
