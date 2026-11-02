'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function OfficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Office Error" showDetails />;
}
