"use client";

import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * RouteBackground — flat app canvas for hub and non-auth routes.
 * Auth routes use `AuthAmbientBackground` (decoupled WebM layer in auth layout).
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
