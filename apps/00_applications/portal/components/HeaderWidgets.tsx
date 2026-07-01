"use client";

import { lazy, Suspense } from "react";

const ServicesDropdown = lazy(() =>
  import("@/components/nav/ServicesDropdown").then((m) => ({
    default: m.ServicesDropdown,
  })),
);

/**
 * HeaderWidgets — inline services chevron at the end of the taskbar status strip.
 */
export function HeaderWidgets() {
  return (
    <Suspense fallback={null}>
      <ServicesDropdown variant="inline" />
    </Suspense>
  );
}
