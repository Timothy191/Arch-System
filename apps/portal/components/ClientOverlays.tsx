"use client";

import dynamic from "next/dynamic";

// AGENT-TRACE: Client component wrapper for dynamically imported overlays with ssr: false off critical hydration path.
const CookieConsent = dynamic(() => import("@repo/ui/CookieConsent").then((m) => m.CookieConsent), {
  ssr: false,
});

const PWAInstallButton = dynamic(
  () => import("@/components/PWAInstallButton").then((m) => m.PWAInstallButton),
  { ssr: false },
);

export function ClientOverlays() {
  return (
    <>
      <PWAInstallButton />
      <CookieConsent />
    </>
  );
}
