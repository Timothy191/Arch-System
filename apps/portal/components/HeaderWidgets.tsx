"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// AGENT-TRACE: Converted React.lazy → next/dynamic for proper Next.js code
// splitting, chunk prefetching, and SSR control.
const FeedbackWidget = dynamic(
  () => import("@/components/FeedbackWidget").then((m) => ({ default: m.FeedbackWidget })),
  { ssr: false },
);

const SystemClock = dynamic(
  () => import("@/components/clock/SystemClock").then((m) => ({ default: m.SystemClock })),
  { ssr: false },
);

const ServicesDropdown = dynamic(
  () => import("@/components/nav/ServicesDropdown").then((m) => ({ default: m.ServicesDropdown })),
  { ssr: false },
);

/**
 * HeaderWidgets
 *
 * Groups the support/feedback widget, system clock, and services dropdown into a single
 * lazy-loaded chunk for the top taskbar header.
 */
function WidgetFallback({ width = "w-7" }: { width?: string }) {
  return (
    <div
      className={`${width} h-7 rounded-full bg-black/[0.03] border border-black/[0.05] animate-pulse`}
      aria-hidden="true"
    />
  );
}

export function HeaderWidgets() {
  return (
    <>
      <Suspense fallback={<WidgetFallback width="w-16" />}>
        <FeedbackWidget variant="header" />
      </Suspense>

      <Suspense fallback={<WidgetFallback width="w-20" />}>
        <SystemClock />
      </Suspense>

      <Suspense fallback={<WidgetFallback />}>
        <ServicesDropdown />
      </Suspense>
    </>
  );
}
