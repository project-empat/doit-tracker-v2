import { Auth, type AuthConfig } from "@auth/core";
import Google from "@auth/core/providers/google";
import type { Context } from "hono";
import { getOrCreateUser } from "../lib/user";
import { initializeDb } from "../db";

type Env = {
	DB: D1Database;
	AUTH_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
};

function authConfig(c: Context): AuthConfig {
	const env = c.env as Env;
	return {
		providers: [
			Google({
				clientId: env.GOOGLE_CLIENT_ID ?? "",
				clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
				authorization: {
					params: { prompt: "consent", access_type: "offline", response_type: "code" },
				},
			}),
		],
		secret: env.AUTH_SECRET,
		trustHost: true,
		callbacks: {
			async session({ session, token }) {
				if (session?.user?.email && token.sub && session.user) {
					try {
						initializeDb({ DB: env.DB });
						const dbUser = await getOrCreateUser({
							id: token.sub,
							email: session.user.email,
							name: session.user.name ?? null,
							image: session.user.image ?? null,
						});
						if (dbUser?.id) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(session.user as unknown as { id: string }).id = dbUser.id;
						}
					} catch (e) {
						console.error("Session callback error:", e);
					}
				}
				return session;
			},
			async jwt({ token, profile, account }) {
				if (profile && account && token.email) {
					try {
						initializeDb({ DB: env.DB });
						const dbUser = await getOrCreateUser({
							id: token.sub ?? "",
							email: token.email,
							name: token.name ?? null,
							image: token.picture ?? null,
						});
						if (dbUser?.id) token.sub = dbUser.id;
					} catch (e) {
						console.error("JWT callback error:", e);
						throw e;
					}
				}
				return token;
			},
		},
	};
}

export async function handleAuth(c: Context) {
	const url = new URL(c.req.url);

	const headers = new Headers(c.req.raw.headers);
	const body =
		c.req.method !== "GET" && c.req.method !== "HEAD"
			? await c.req.raw.clone().blob()
			: undefined;

	const authReq = new Request(url.toString(), {
		method: c.req.method,
		headers,
		body,
	});

	const authRes = await Auth(authReq, authConfig(c));

	const resHeaders = new Headers(authRes.headers);
	const resBody = await authRes.text();

	for (const [key, value] of resHeaders) {
		c.res.headers.set(key, value);
	}
	c.status(authRes.status as 200 | 301 | 302 | 303 | 307 | 400 | 401 | 403 | 404 | 500);
	return c.body(resBody);
}

export async function getSession(c: Context): Promise<Record<string, unknown> | null> {
	try {
		const url = new URL(c.req.url);
		const sessionReq = new Request(`${url.origin}/auth/session`, {
			headers: {
				Cookie: c.req.header("Cookie") ?? "",
				"Content-Type": "application/json",
			},
		});

		const res = await Auth(sessionReq, authConfig(c));
		if (!res.ok) return null;

		return await res.json() as Record<string, unknown>;
	} catch (e) {
		console.error("getSession error:", e);
		return null;
	}
}
