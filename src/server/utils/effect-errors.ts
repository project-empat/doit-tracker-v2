import { Cause, Data, Effect } from "effect";

const FIBER_FAILURE_CAUSE = Symbol.for("effect/Runtime/FiberFailure/Cause");

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	message: string;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
	message: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	message: string;
	details?: unknown;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
	message: string;
}> {}

export type AppErrors =
	| DatabaseError
	| NotFoundError
	| ValidationError
	| UnauthorizedError;

export function unwrapEffectError(error: unknown): unknown {
	if (
		error !== null &&
		typeof error === "object" &&
		FIBER_FAILURE_CAUSE in error
	) {
		const cause = (error as Record<symbol, unknown>)[FIBER_FAILURE_CAUSE];
		const failure = Cause.failureOption(cause as never);
		if (failure._tag === "Some") return failure.value;
	}
	return error;
}

export function dbEffect<T>(
	operation: () => Promise<T>,
	message = "Database operation failed",
): Effect.Effect<T, DatabaseError> {
	return Effect.tryPromise({
		try: operation,
		catch: (error) => {
			const details = error instanceof Error ? error.message : String(error);
			console.error(`Database operation failed: ${details}`, error);
			return new DatabaseError({ message: `${message}: ${details}` });
		},
	});
}

export function getErrorStatusCode(error: AppErrors): number {
	switch (error._tag) {
		case "ValidationError":
			return 400;
		case "UnauthorizedError":
			return 401;
		case "NotFoundError":
			return 404;
		case "DatabaseError":
			return 500;
		default:
			return 500;
	}
}

export function toErrorResponse(error: AppErrors): {
	error: { code: string; message: string; details?: unknown };
} {
	return {
		error: {
			code: error._tag,
			message: error.message,
			details: "details" in error ? error.details : undefined,
		},
	};
}
