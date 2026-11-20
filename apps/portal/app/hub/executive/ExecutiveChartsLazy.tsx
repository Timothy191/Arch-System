'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ExecutiveChartsProps } from './ExecutiveChartsClient';

function ChartsSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="h-80 animate-pulse rounded-xl bg-[var(--bg-tertiary)] lg:col-span-2" />
      <div className="h-80 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
    </div>
  );
}

/** Lazy, client-only entry so recharts stays out of the RSC payload and initial bundle. */
export const ExecutiveCharts: ComponentType<ExecutiveChartsProps> = dynamic(
  () => import('./ExecutiveChartsClient').then((mod) => mod.ExecutiveChartsClient),
  { ssr: false, loading: ChartsSkeleton }
);
