"use client";

import { useFocusMode } from "@/hooks/useFocusMode";
import { useEffect, useState } from "react";

export function HeroBackground() {
  const { enabled } = useFocusMode();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (enabled) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden isolate"
      aria-hidden="true"
    >
      {/* Light ambient base */}
      <div className="absolute inset-0 bg-arch-surface-primary" />

      {/* Video Background (hidden if prefers reduced motion) */}
      {!prefersReducedMotion && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover mix-blend-normal opacity-90 transition-opacity duration-1000"
          src="/background/light-mode/light mode.mp4"
        />
      )}

      {/* Ambient Film Grain Overlay */}
      <div className="absolute inset-0 route-bg-grain opacity-40 mix-blend-overlay" />

      {/* Fallback blobs (shown if prefers reduced motion) */}
      {prefersReducedMotion && (
        <>
          <div
            className="absolute -top-16 -left-16 sm:-top-20 sm:-left-20 w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[28rem] lg:h-[28rem] xl:w-[32rem] xl:h-[32rem] rounded-full bg-arch-surface-secondary blur-3xl will-change-transform motion-reduce:opacity-100 animate-blob-in"
            style={{ transform: "translateZ(0)" }}
          />
          <div
            className="absolute -bottom-16 -right-16 sm:-bottom-20 sm:-right-20 w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-[26rem] lg:h-[26rem] xl:w-[28rem] xl:h-[28rem] rounded-full bg-arch-surface-tertiary blur-3xl will-change-transform motion-reduce:opacity-100 animate-blob-in"
            style={{ transform: "translateZ(0)" }}
          />
        </>
      )}
    </div>
  );
}
