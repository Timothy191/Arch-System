"use client";

import { useEffect, useState, useRef } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";
import { FluidCanvas } from "@repo/ui/FluidCanvas";

/**
 * RouteBackground
 *
 * Renders the full-screen macOS 27 Golden wallpaper background beneath all portal
 * content across all server pages.
 */
export function RouteBackground() {
  const focusModeEnabled = useFocusMode((s) => s.enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (videoRef.current && !prefersReducedMotion) {
      videoRef.current.play().catch(() => {});
    }
  }, [prefersReducedMotion]);

  return (
    <>
      {/* ── Full-Screen Event Horizon Video Background ── */}
      {/* AGENT-TRACE: 4K (3840x2160) H.264 video background asset — preload=auto ensures early loading. ── */}
      <div
        className="fixed inset-0 overflow-hidden -z-10 route-bg-video-container"
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          id="route-bg-light-video"
          src="/background/edge-of-the-event-horizon.3840x2160.mp4"
          poster="/background/macos-27-golden-2560x1764.png"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`route-bg-video object-cover object-center w-full h-full filter brightness-95 saturate-110 ${
            prefersReducedMotion ? "" : "transition-opacity duration-300"
          }`}
        />
        {/* Interactive Fluid Simulation Overlay */}
        <FluidCanvas
          brushRadius={32}
          dissipation={0.97}
          impulseIntensity={1.8}
          className="absolute inset-0 opacity-45 mix-blend-screen"
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
