"use client";

import { lazy, Suspense } from "react";

const ServicesDropdown = lazy(() =>
  import("@/components/nav/ServicesDropdown").then((m) => ({
    default: m.ServicesDropdown,
  })),
);

/**
 * HeaderWidgets — services popover only (clock lives in SystemTrayPill status strip).
 */
function WidgetFallback({ width = "w-7" }: { width?: string }) {
  return (
    <div
      className={`${width} h-7 rounded-full brand-chrome-pill animate-pulse`}
      aria-hidden="true"
    />
  );
}

export function HeaderWidgets() {
  return (
    <Suspense fallback={<WidgetFallback />}>
      <ServicesDropdown />
    </Suspense>
  );
}
