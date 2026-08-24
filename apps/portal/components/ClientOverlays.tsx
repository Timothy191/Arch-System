"use client";

import dynamic from "next/dynamic";

// AGENT-TRACE: Client component wrapper for dynamically imported overlays.
// CookieConsent is intentionally NOT ssr:false — it must be server-rendered into the
// initial HTML so it paints at first paint instead of post-hydration. A late-painting
// full-width banner was winning LCP on the login page (4.4s in dev). PWAInstallButton
// stays ssr:false (it is not contentful and must not flash).
const CookieConsent = dynamic(() => import("@repo/ui/CookieConsent").then((m) => m.CookieConsent));

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
