"use client";

import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * RouteBackground — flat app canvas beneath all portal content.
 * No video, grain, or decorative layers.
 */
export function RouteBackground() {
  useFocusMode((s) => s.enabled);

  return (
    <>
      <div className="route-bg-fallback" aria-hidden="true" />
      <div className="route-bg-focus-scrim" aria-hidden="true" />
    </>
  );
}
