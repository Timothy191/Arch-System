'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function DatabaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Database Error" showDetails />;
}
