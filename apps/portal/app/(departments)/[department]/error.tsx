'use client';

import { SecondaryButton } from '@repo/ui/SecondaryButton';
import Link from 'next/link';
import { useEffect } from 'react';
import { isAppError, isAuthError, isNotFoundError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';

interface DepartmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function getErrorTitle(error: Error): string {
  if (isNotFoundError(error)) return 'Department not found';
  if (isAuthError(error)) return 'Access denied';
  if (isAppError(error)) return error.name.replace(/([A-Z])/g, ' $1').trim();
  return 'Department Error';
}

function getErrorMessage(error: Error): string {
  if (isAppError(error)) return error.message;
  return error.message || 'Failed to load department data.';
}

function getActionLink(error: Error): { href: string; label: string } {
  if (isNotFoundError(error)) {
    return { href: '/', label: 'Back to Hub' };
  }
  if (isAuthError(error)) {
    return { href: '/login', label: 'Sign in' };
  }
  return { href: '/', label: 'Back to Hub' };
}

export default function DepartmentError({ error, reset }: DepartmentErrorProps) {
  useEffect(() => {
    if (isAppError(error)) {
      logError(error);
    } else {
      logError(error);
    }
  }, [error]);

  const title = getErrorTitle(error);
  const message = getErrorMessage(error);
  const action = getActionLink(error);
  const appError = isAppError(error) ? (error as any) : null;

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
