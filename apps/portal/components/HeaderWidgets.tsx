'use client';

import { ArchSeparator } from '@repo/ui/Separator';
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
      <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

      <SystemClock embedded />

      <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

      <ServicesDropdown embedded />
    </>
  );
}
