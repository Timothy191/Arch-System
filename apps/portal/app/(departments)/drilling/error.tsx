"use client";

import { ErrorFallback } from "@/components/ErrorFallback";

export default function DrillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Drilling Error" showDetails />;
}
