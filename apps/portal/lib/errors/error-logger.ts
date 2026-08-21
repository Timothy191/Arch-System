/**
 * Error Logging Utility
 *
 * Provides structured error logging for both AppError instances
 * and generic errors. Integrates with monitoring systems.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Error severity levels
 */
type ErrorSeverity = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Structured error log entry
 */
interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  code?: string;
  statusCode?: number;
  message: string;
  context?: Record<string, unknown>;
  cause?: unknown;
  stack?: string;
  url?: string;
  method?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Determine error severity based on status code
 */
function getSeverity(statusCode?: number): ErrorSeverity {
  if (!statusCode) return "error";
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

/**
 * Read a string field off a plain object, or undefined.
 */
function strField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Create a structured error log entry
 *
 * Accepts `unknown` because callers legitimately catch non-Error throwables —
 * most notably Supabase's `PostgrestError`, which is a plain object
 * `{ message, code, details, hint }` and NOT an `Error` instance. String()-ing
 * such an object yields "[object Object]" and drops its `code`, which is why
 * the hourly-loads save path previously logged `UNKNOWN: [object Object]`.
 */
function createErrorLog(
  error: unknown,
  context?: {
    url?: string;
    method?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
  },
): ErrorLogEntry {
  const timestamp = new Date().toISOString();

  // AGENT-TRACE: Non-Error throwables (e.g. Supabase PostgrestError) are plain
  // objects. Read their fields directly instead of String()-ing them, so the
  // real message and code survive instead of becoming "[object Object]".
  if (!(error instanceof Error)) {
    const obj = (error ?? {}) as Record<string, unknown>;
    const message = strField(obj, "message") ?? String(error);
    const statusCode = typeof obj.statusCode === "number" ? obj.statusCode : undefined;
    return {
      timestamp,
      severity: getSeverity(statusCode),
      code: strField(obj, "code"),
      statusCode,
      message,
      context: context as Record<string, unknown> | undefined,
      cause: obj.cause,
      stack: strField(obj, "stack"),
      url: context?.url,
      method: context?.method,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };
  }

  // Check if error has AppError-like properties
  const hasAppErrorProps =
    "code" in error && "statusCode" in error && "context" in error && "cause" in error;

  if (hasAppErrorProps) {
    const appError = error as Error & {
      code?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: unknown;
    };
    return {
      timestamp,
      severity: getSeverity(appError.statusCode),
      code: appError.code,
      statusCode: appError.statusCode,
      message: error.message,
      context: { ...appError.context, ...context },
      cause: appError.cause,
      stack: error.stack,
      url: context?.url,
      method: context?.method,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };
  }

  // Generic error handling
  return {
    timestamp,
    severity: "error",
    message: error.message,
    stack: error.stack,
    url: context?.url,
    method: context?.method,
    userId: context?.userId,
    sessionId: context?.sessionId,
  };
}

/**
 * Send error to monitoring service
 *
 * Sends structured error to console (dev) and Sentry (via global init).
 */
async function sendToMonitoring(entry: ErrorLogEntry): Promise<void> {
  const error = new Error(entry.message);
  if (entry.stack) {
    error.stack = entry.stack;
  }

  // AGENT-TRACE: In production, skip console output — Sentry handles error capture.
  // In development, log to console for local debugging.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    const logMethod =
      entry.severity === "error" || entry.severity === "fatal"
        ? console.error // eslint-disable-line no-console
        : console.warn; // eslint-disable-line no-console

    logMethod(`[${entry.severity.toUpperCase()}] ${entry.code || "UNKNOWN"}: ${entry.message}`, {
      timestamp: entry.timestamp,
      statusCode: entry.statusCode,
      context: entry.context,
      url: entry.url,
      method: entry.method,
    });
  }

  // Forward server-side errors to Sentry — warn/info are expected control-flow (4xx) and not captured
  if (entry.severity === "error" || entry.severity === "fatal") {
    Sentry.captureException(error, {
      extra: {
        code: entry.code,
        statusCode: entry.statusCode,
        context: entry.context,
        url: entry.url,
        method: entry.method,
        userId: entry.userId,
        sessionId: entry.sessionId,
      },
    });
  }
}

/**
 * Main error logger function
 *
 * Usage:
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   await logError(error, { url: req.url, method: req.method });
 * }
 * ```
 */
export async function logError(
  error: unknown,
  context?: {
    url?: string;
    method?: string;
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
  },
): Promise<void> {
  try {
    const entry = createErrorLog(error, context);
    await sendToMonitoring(entry);
  } catch {
    // logError must never throw - monitoring failures should not crash the app
  }
}

/**
 * Create an API route error handler
 *
 * Wraps API route handlers with automatic error logging
 *
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   return withErrorLogging(req, async () => {
 *     // Your route logic
 *   });
 * }
 * ```
 */
export async function withErrorLogging<T>(
  req: Request,
  handler: () => Promise<T>,
  options?: {
    userId?: string;
    sessionId?: string;
  },
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Error) {
      await logError(error, {
        url: req.url,
        method: req.method,
        userId: options?.userId,
        sessionId: options?.sessionId,
      });
    }
    throw error; // Re-throw for error boundaries
  }
}

/**
 * Server action error logger
 *
 * Usage in server actions:
 * ```typescript
 * "use server";
 *
 * export async function createUser(data: UserData) {
 *   return await withServerActionLogging(async () => {
 *     // Your action logic
 *   });
 * }
 * ```
 */
export async function withServerActionLogging<T>(
  handler: () => Promise<T>,
  actionName: string,
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Error) {
      await logError(error, {
        action: actionName,
      });
    }
    throw error;
  }
}
