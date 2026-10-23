'use client';

import { SecondaryButton } from '@repo/ui/SecondaryButton';
import Link from 'next/link';
import { useEffect } from 'react';
import { isAppError, isAuthError, isNotFoundError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  showDetails?: boolean;
}

function getErrorTitle(error: Error, fallback?: string): string {
  if (isNotFoundError(error)) return 'Not found';
  if (isAuthError(error)) return 'Access denied';
  if (isAppError(error)) return error.name.replace(/([A-Z])/g, ' $1').trim();
  return fallback ?? 'Something went wrong';
}

function getErrorMessage(error: Error): string {
  if (isAppError(error)) return error.message;
  return error.message || 'An unexpected error occurred. Please try again.';
}

function getActionLink(error: Error): { href: string; label: string } {
  if (isNotFoundError(error)) return { href: '/', label: 'Back to Hub' };
  if (isAuthError(error)) return { href: '/login', label: 'Sign in' };
  return { href: '/', label: 'Back to Hub' };
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
