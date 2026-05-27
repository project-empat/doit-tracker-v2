import { Effect } from "effect";
import type { Context } from "hono";
import {
	type AppErrors,
	getErrorStatusCode,
	toErrorResponse,
	unwrapEffectError,
} from "./effect-errors";

type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500 | 502;

function handleEffectError(c: Context, error: unknown): Response {
	const actual = unwrapEffectError(error);
	if (
		actual &&
		typeof actual === "object" &&
		"_tag" in actual
	) {
		const appError = actual as AppErrors;
		return c.json(
			toErrorResponse(appError),
			getErrorStatusCode(appError) as StatusCode,
		);
	}
	return c.json(
		{ error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
		500,
	);
}

export function runEffect<T>(
	c: Context,
	effect: Effect.Effect<T, AppErrors>,
	statusCode: StatusCode = 200,
): Promise<Response> {
	return Effect.runPromise(effect).then(
		(data) => c.json(data, statusCode),
		(error) => handleEffectError(c, error),
	);
}
