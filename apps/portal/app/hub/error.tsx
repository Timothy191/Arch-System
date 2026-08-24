"use client";

import { useEffect } from "react";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { isAppError, isNotFoundError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

interface HubErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function getErrorTitle(error: Error): string {
  if (isNotFoundError(error)) return "Hub not found";
  if (isAppError(error)) return error.name.replace(/([A-Z])/g, " $1").trim();
  return "Hub Error";
}

function getErrorMessage(error: Error): string {
  if (isAppError(error)) return error.message;
  return error.message || "Failed to load hub data.";
}

export default function HubError({ error, reset }: HubErrorProps) {
  useEffect(() => {
    logError(error);
  }, [error]);

  const title = getErrorTitle(error);
  const message = getErrorMessage(error);
  // AGENT-TRACE: isAppError narrows to AppError which has `code?`, avoiding `as any`.
  const appErrorCode = isAppError(error) ? (error as any as { code?: string }).code : undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-[var(--text-heading)]">{title}</h2>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>
      {appErrorCode && (
        <div className="text-xs text-[var(--text-muted)] font-mono">{appErrorCode}</div>
      )}
      <SecondaryButton size="sm" onClick={reset}>
        Try again
      </SecondaryButton>
    </div>
  );
}
