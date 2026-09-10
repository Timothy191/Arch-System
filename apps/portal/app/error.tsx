"use client";

// AGENT-TRACE: error.tsx is intentionally kept dependency-light so the error
// boundary loads fast even when the rest of the app is broken. It avoids
// next/image (full image pipeline), @repo/ui (Radix slot), and the eager
// Sentry import from error-logger. Sentry is already initialized globally via
// sentry.client.config.ts, so unhandled errors are captured automatically; the
// structured logger is code-split so it never bloats this boundary's bundle.
import { useEffect } from "react";
import {
  isAppError,
  isAuthError,
  isNotFoundError,
  isValidationError,
} from "@/lib/errors/error-classes";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Get user-friendly error title based on error type
 */
function getErrorTitle(error: Error): string {
  if (isNotFoundError(error)) return "Page not found";
  if (isAuthError(error)) return "Access denied";
  if (isValidationError(error)) return "Invalid input";
  if (isAppError(error)) {
    // Use the error name for other AppErrors
    return error.name.replace(/([A-Z])/g, " $1").trim();
  }
  return "Something went wrong";
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: Error): string {
  if (isAppError(error)) {
    // AppError has user-friendly messages
    return error.message;
  }
  // Fallback for generic errors
  return error.message || "An unexpected error occurred. Please try again.";
}

/**
 * Get error context for debugging (only shown in development)
 */
function getErrorContext(error: Error): Record<string, unknown> | null {
  if (isAppError(error) && error.context) {
    return error.context;
  }
  return null;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // Code-split the Sentry-backed structured logger so it never lands in the
    // error boundary's initial bundle. Sentry's global init still captures
    // unhandled errors automatically.
    import("@/lib/errors/error-logger")
      .then(({ logError }) => logError(error))
      .catch(() => {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
  }, [error]);

  const title = getErrorTitle(error);
  const message = getErrorMessage(error);
  const context = getErrorContext(error);
  const isDev = process.env.NODE_ENV === "development";
  const appError = isAppError(error) ? (error as any) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <img
            src="/error-pages/404-error.png"
            alt="Error Graphic"
            width={120}
            height={120}
            className="opacity-80 hover:opacity-100 transition-opacity duration-200"
          />
        </div>
        <div className="space-y-2" role="alert" aria-live="assertive">
          <h1 className="text-3xl font-medium text-[var(--text-heading)]">{title}</h1>
          <p className="text-[var(--text-muted)] text-sm">{message}</p>
        </div>

        {/* Show error code for AppErrors */}
        {appError && (
          <div className="text-xs text-[var(--text-muted)] font-mono">
            Error code: {appError.code}
            {appError.statusCode && ` (${appError.statusCode})`}
          </div>
        )}

        {/* Show context in development */}
        {isDev && context && (
          <details className="text-left">
            <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)] overflow-auto">
              {JSON.stringify(context, null, 2)}
            </pre>
          </details>
        )}

        <button
          onClick={reset}
          className="rounded-full px-6 py-2.5 bg-white/80 text-[var(--text-heading)] text-sm font-medium border border-[var(--border-default)] hover:bg-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
