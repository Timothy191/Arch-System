'use client';

import { SecondaryButton } from '@repo/ui/SecondaryButton';
import Link from 'next/link';
import { useEffect } from 'react';
import { isAppError } from '@/lib/errors/error-classes';
import { getActionLink, getErrorMessage, getErrorTitle } from '@/lib/errors/error-display';
import { logError } from '@/lib/errors/error-logger';

interface DepartmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DepartmentError({ error, reset }: DepartmentErrorProps) {
  useEffect(() => {
    logError(error);
  }, [error]);

  const title = getErrorTitle(error, {
    fallbackTitle: 'Department Error',
    notFoundTitle: 'Department not found',
  });
  const message = getErrorMessage(error, 'Failed to load department data.');
  const action = getActionLink(error);
  const appError = isAppError(error) ? error : null;

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-2xl text-[var(--text-heading)]">{title}</h2>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>
      {appError && (
        <div className="font-mono text-[var(--text-muted)] text-xs">
          {appError.code}
          {appError.statusCode && ` (${appError.statusCode})`}
        </div>
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
