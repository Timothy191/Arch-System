/**
 * @repo/contract/validation — Runtime API request validation middleware
 *
 * Provides Zod-based validation for Next.js App Router API routes using the
 * same Higher-Order Function (HOF) pattern as `@repo/logger`'s `withLogging`.
 *
 * @example
 * ```ts
 * import { withValidation } from "@repo/contract/validation";
 * import { telemetryPushSchema } from "@repo/contract";
 *
 * export const POST = withValidation(telemetryPushSchema, async (req, data) => {
 *   // data is typed as TelemetryPushInput
 *   return Response.json({ received: data.name });
 * });
 * ```
 */

import { z, ZodError } from "zod";

// ---------------------------------------------------------------------------
// ValidationError — structured error for API validation failures
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  public readonly statusCode: number;
  public readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// validateBody — parse and validate a Request body against a Zod schema
// ---------------------------------------------------------------------------
/* AGENT-TRACE: Uses safeParse instead of parse to avoid uncaught ZodError
 * throwing. We catch the safeParse error result, re-throw as ValidationError,
 * and leave the catch block for JSON parse errors. This keeps the boundary
 * parse (Law 2: Parse Dont Validate) while providing structured error output. */

/**
 * Validates the JSON body of a `Request` against the given Zod schema.
 *
 * Returns the typed parsed data on success.
 * Throws `ValidationError` with structured `z.ZodIssue[]` on failure.
 *
 * @throws {ValidationError} If the body is missing, not valid JSON,
 *   or fails schema validation.
 */
export async function validateBody<T>(schema: z.ZodType<T>, request: Request): Promise<T> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError("Request body validation failed", result.error.issues);
    }

    return result.data;
  } catch (err) {
    // Re-throw ValidationError from safeParse above
    if (err instanceof ValidationError) throw err;

    // Catch ZodError for cases where the schema itself throws
    if (err instanceof ZodError) {
      throw new ValidationError("Request body validation failed", err.issues);
    }

    // Invalid JSON or other parse errors
    throw new ValidationError("Request body must be valid JSON", []);
  }
}

// ---------------------------------------------------------------------------
// withValidation — HOF that wraps a route handler with body validation
// ---------------------------------------------------------------------------

/**
 * Higher-order function that wraps a Next.js App Router route handler with
 * automatic request body validation against a Zod schema.
 *
 * On validation failure, returns a `Response` with status 400 and a JSON body
 * containing `{ error: string, issues: z.ZodIssue[] }`.
 *
 * Usage:
 * ```ts
 * export const POST = withValidation(mySchema, async (req, data, { params }) => {
 *   // data is typed according to mySchema
 * });
 * ```
 */
export function withValidation<T>(
  schema: z.ZodType<T>,
  handler: (
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    request: Request,
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    data: T,
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    context: { params: Promise<unknown> },
  ) => Promise<Response> | Response,
): (
  // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
  request: Request,
  // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
  context: { params: Promise<unknown> },
) => Promise<Response> {
  return async (request: Request, context: { params: Promise<unknown> }): Promise<Response> => {
    try {
      const data = await validateBody(schema, request);
      return await handler(request, data, context);
    } catch (err) {
      if (err instanceof ValidationError) {
        return Response.json(
          { error: err.message, issues: err.issues },
          { status: err.statusCode },
        );
      }

      // Re-throw non-validation errors to the framework error boundary
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// withQueryValidation — HOF that validates URL search params
// ---------------------------------------------------------------------------

/**
 * Higher-order function that wraps a Next.js App Router route handler with
 * automatic query parameter validation against a Zod schema.
 *
 * On validation failure, returns a `Response` with status 400 and a JSON body
 * containing `{ error: string, issues: z.ZodIssue[] }`.
 *
 * Usage:
 * ```ts
 * export const GET = withQueryValidation(myQuerySchema, async (req, query, { params }) => {
 *   // query is typed according to myQuerySchema
 * });
 * ```
 */
export function withQueryValidation<T>(
  schema: z.ZodType<T>,
  handler: (
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    request: Request,
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    query: T,
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    context: { params: Promise<unknown> },
  ) => Promise<Response> | Response,
): (
  // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
  request: Request,
  // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
  context: { params: Promise<unknown> },
) => Promise<Response> {
  return async (request: Request, context: { params: Promise<unknown> }): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams.entries());
      const result = schema.safeParse(params);

      if (!result.success) {
        return Response.json(
          {
            error: "Query parameter validation failed",
            issues: result.error.issues,
          },
          { status: 400 },
        );
      }

      return await handler(request, result.data as T, context);
    } catch (err) {
      if (err instanceof ValidationError) {
        return Response.json(
          { error: err.message, issues: err.issues },
          { status: err.statusCode },
        );
      }

      throw err;
    }
  };
}
