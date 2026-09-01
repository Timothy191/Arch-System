"use client";

import { ErrorFallback } from "@/components/ErrorFallback";

export default function AccessControlError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Access Control Error" showDetails />;
}
