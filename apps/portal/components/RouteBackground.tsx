"use client";

import { useEffect, useState } from "react";
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
      {/* ── Full-Screen Event Horizon Video Background ── */}
      {/* AGENT-TRACE: 1080p H.264 (5.2MB vs 28MB 4K) — downscaled via ffmpeg to cut
          decode cost and network transfer; 4K was saturating the compositor on the
          hub page. preload=auto ensures early loading. ── */}
      <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <video
          src="/background/edge-of-the-event-horizon.1920x1080.mp4"
          poster="/background/macos-27-golden-2560x1764.png"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`object-cover object-center w-full h-full filter brightness-95 saturate-110 ${
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
