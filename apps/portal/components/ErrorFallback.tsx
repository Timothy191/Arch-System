"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { isAppError, isNotFoundError, isAuthError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  showDetails?: boolean;
}

function getErrorTitle(error: Error, fallback?: string): string {
  if (isNotFoundError(error)) return "Not found";
  if (isAuthError(error)) return "Access denied";
  if (isAppError(error)) return error.name.replace(/([A-Z])/g, " $1").trim();
  return fallback ?? "Something went wrong";
}

function getErrorMessage(error: Error): string {
  if (isAppError(error)) return error.message;
  return error.message || "An unexpected error occurred. Please try again.";
}

function getActionLink(error: Error): { href: string; label: string } {
  if (isNotFoundError(error)) return { href: "/", label: "Back to Hub" };
  if (isAuthError(error)) return { href: "/login", label: "Sign in" };
  return { href: "/", label: "Back to Hub" };
}

export function ErrorFallback({ error, reset, title, showDetails = false }: ErrorFallbackProps) {
  useEffect(() => {
    logError(error);
  }, [error]);

  const displayTitle = getErrorTitle(error, title);
  const message = getErrorMessage(error);
  const action = getActionLink(error);
  const appError = isAppError(error) ? error : null;

  return (
    <div className="space-y-6 p-6" role="alert" aria-live="assertive">
      <h2 className="text-2xl font-medium text-[var(--text-heading)]">{displayTitle}</h2>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>

      {appError && "code" in appError && (
        <div className="text-xs text-[var(--text-muted)] font-mono">
          Error code: {(appError as { code: string }).code}
        </div>
      )}

      {showDetails && process.env.NODE_ENV === "development" && (
        <details className="text-left">
          <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
            Error details (dev only)
          </summary>
          <pre className="mt-2 p-3 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)] overflow-auto max-h-40">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      <div className="flex items-center gap-3">
        <SecondaryButton size="sm" onClick={reset}>
          Try again
        </SecondaryButton>
        <Link
          href={action.href}
          className="px-4 py-2 rounded-full text-[var(--text-muted)] text-sm hover:text-[var(--text-heading)] transition-colors"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
