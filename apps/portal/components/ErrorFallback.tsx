'use client';

import { SecondaryButton } from '@repo/ui/SecondaryButton';
import Link from 'next/link';
import { useEffect } from 'react';
import { isAppError } from '@/lib/errors/error-classes';
import { getActionLink, getErrorMessage, getErrorTitle } from '@/lib/errors/error-display';
import { logError } from '@/lib/errors/error-logger';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  showDetails?: boolean;
}

export function ErrorFallback({ error, reset, title, showDetails = false }: ErrorFallbackProps) {
  useEffect(() => {
    logError(error);
  }, [error]);

  const displayTitle = getErrorTitle(error, { fallbackTitle: title });
  const message = getErrorMessage(error);
  const action = getActionLink(error);
  const appError = isAppError(error) ? error : null;

  return (
    <div className="space-y-6 p-6" role="alert" aria-live="assertive">
      <h2 className="font-medium text-2xl text-[var(--text-heading)]">{displayTitle}</h2>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>

      {appError && 'code' in appError && (
        <div className="font-mono text-[var(--text-muted)] text-xs">
          Error code: {(appError as { code: string }).code}
        </div>
      )}

      {showDetails && process.env.NODE_ENV === 'development' && (
        <details className="text-left">
          <summary className="cursor-pointer text-[var(--text-muted)] text-xs">
            Error details (dev only)
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-[var(--bg-secondary)] p-3 text-[var(--text-muted)] text-xs">
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
          className="rounded-full px-4 py-2 text-[var(--text-muted)] text-sm transition-colors hover:text-[var(--text-heading)]"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
