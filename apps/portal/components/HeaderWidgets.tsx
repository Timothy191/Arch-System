'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// AGENT-TRACE: Converted React.lazy → next/dynamic for proper Next.js code
// splitting, chunk prefetching, and SSR control.
const SystemClock = dynamic(
  () => import('@/components/clock/SystemClock').then((m) => ({ default: m.SystemClock })),
  { ssr: false }
);

const ServicesDropdown = dynamic(
  () => import('@/components/nav/ServicesDropdown').then((m) => ({ default: m.ServicesDropdown })),
  { ssr: false }
);

/**
 * HeaderWidgets
 *
 * Groups the system clock and services dropdown into a single
 * lazy-loaded chunk for the top taskbar header. Support / Feedback is now
 * cleanly merged into SystemTrayPill.
 */
function WidgetFallback({ width = 'w-14' }: { width?: string }) {
  return (
    <div className={`${width} h-4 animate-pulse rounded-full bg-black/5`} aria-hidden="true" />
  );
}

export function HeaderWidgets() {
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="system-tray-gold-separator"
        className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
      >
        |
      </span>

      <Suspense fallback={<WidgetFallback width="w-14" />}>
        <SystemClock embedded />
      </Suspense>

      <span
        aria-hidden="true"
        data-testid="system-tray-gold-separator"
        className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
      >
        |
      </span>

      <Suspense fallback={<WidgetFallback width="w-4" />}>
        <ServicesDropdown embedded />
      </Suspense>
    </>
  );
}
