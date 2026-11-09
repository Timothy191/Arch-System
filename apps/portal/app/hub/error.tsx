'use client';

import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { useEffect } from 'react';
import { isAppError } from '@/lib/errors/error-classes';
import { getErrorMessage, getErrorTitle } from '@/lib/errors/error-display';
import { logError } from '@/lib/errors/error-logger';

interface HubErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function HubError({ error, reset }: HubErrorProps) {
  useEffect(() => {
    logError(error);
  }, [error]);

  const title = getErrorTitle(error, {
    fallbackTitle: 'Hub Error',
    notFoundTitle: 'Hub not found',
  });
  const message = getErrorMessage(error, 'Failed to load hub data.');
  // AGENT-TRACE: isAppError narrows to AppError which has `code?`, avoiding `as any`.
  const appErrorCode = isAppError(error) ? error.code : undefined;

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-2xl text-[var(--text-heading)]">{title}</h2>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>
      {appErrorCode && (
        <div className="font-mono text-[var(--text-muted)] text-xs">{appErrorCode}</div>
      )}
      <SecondaryButton size="sm" onClick={reset}>
        Try again
      </SecondaryButton>
    </div>
  );
}
