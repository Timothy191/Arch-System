"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * RouteBackground
 *
 * Renders the full-screen macOS 27 Golden wallpaper background beneath all portal
 * content across all server pages.
 */
export function RouteBackground() {
  const focusModeEnabled = useFocusMode((s) => s.enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <>
      {/* ── Full-Screen macOS 27 Golden Wallpaper ── */}
      {/* AGENT-TRACE: Set priority and fetchPriority=high on LCP wallpaper image for early browser preload discovery */}
      <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <Image
          src="/background/macos-27-golden-4480x3088-26626.png"
          alt="macOS 27 Golden Wallpaper"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className={`object-cover object-center filter brightness-95 saturate-110 ${
            prefersReducedMotion ? "" : "transition-opacity duration-300"
          }`}
        />
      </div>

      {/* ── Tint overlay — legibility scrim for glassmorphism panels ── */}
      <div className="route-bg-tint" aria-hidden="true" />

      {/* ── Ambient Film Grain overlay ── */}
      <div className="route-bg-grain" aria-hidden="true" />

      {/* ── Focus Mode Scrim ── */}
      {focusModeEnabled && <div className="route-bg-focus-scrim" aria-hidden="true" />}
    </>
  );
}
