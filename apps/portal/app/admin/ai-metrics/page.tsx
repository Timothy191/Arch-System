import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AIMetricsDashboard = dynamic(
  () => import("@/components/AIMetricsDashboard").then((m) => m.default),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
          ))}
        </div>
      </div>
    ),
  }
);

export default function AIMetricsPage() {
  return (
    <ErrorBoundary context="AI Metrics Dashboard">
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="w-8 h-8 border-2 border-[var(--accent-blue)]/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
          </div>
        }
      >
        <AIMetricsDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
