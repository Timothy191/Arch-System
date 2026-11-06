'use client';

import dynamic from 'next/dynamic';

function WidgetFallback({ width = 'w-[58px]' }: { readonly width?: string }) {
  return (
    <span className={`inline-block ${width} h-4 rounded-full bg-black/5`} aria-hidden="true" />
  );
}

// AGENT-TRACE: Pass loading placeholders directly to next/dynamic so ssr:false
// reserves exact width during SSR and hydration (eliminates taskbar-unified-pill CLS).
const SystemClock = dynamic(
  () => import('@/components/clock/SystemClock').then((m) => ({ default: m.SystemClock })),
  { ssr: false, loading: () => <WidgetFallback width="w-[58px]" /> }
);

const ServicesDropdown = dynamic(
  () => import('@/components/nav/ServicesDropdown').then((m) => ({ default: m.ServicesDropdown })),
  { ssr: false, loading: () => <WidgetFallback width="w-5" /> }
);

/**
 * HeaderWidgets
 *
 * Groups the system clock and services dropdown into a single
 * lazy-loaded chunk for the top taskbar header. Support / Feedback is now
 * cleanly merged into SystemTrayPill.
 */
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

      <SystemClock embedded />

      <span
        aria-hidden="true"
        data-testid="system-tray-gold-separator"
        className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
      >
        |
      </span>

      <ServicesDropdown embedded />
    </>
  );
}
