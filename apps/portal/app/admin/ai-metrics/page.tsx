import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const AIMetricsDashboard = dynamic(
  () => import('@/components/AIMetricsDashboard').then((m) => m.default),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    ),
  }
);

export default function AIMetricsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <ErrorBoundary context="AI Metrics Dashboard">
        <Suspense
          fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-transparent">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-blue)]/20 border-t-[var(--accent-blue)]" />
            </div>
          }
        >
          <AIMetricsDashboard />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
