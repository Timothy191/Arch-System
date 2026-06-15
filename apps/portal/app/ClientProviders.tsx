"use client";

import { useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";

const SmoothScrollProvider = dynamic(
  () =>
    import("@/components/SmoothScrollProvider").then(
      (mod) => mod.SmoothScrollProvider,
    ),
  { ssr: false },
) as React.FC<{ children: ReactNode }>;

export default function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          Promise.all(registrations.map((r) => r.unregister())).then(
            (results) => {
              if (results.some(Boolean)) {
                // eslint-disable-next-line no-console
                console.log(
                  "Unregistered stale service worker(s) in development mode. Reloading...",
                );
                window.location.reload();
              }
            },
          );
        }
      });
    }
  }, []);

  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
