"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

const FluidCanvas = dynamic(() => import("@repo/ui/FluidCanvas").then((mod) => mod.FluidCanvas), {
  ssr: false,
});

/**
 * RouteBackground
 *
 * Implements the 6-layer viewport stack defined in docs/DESIGN.md Section 5.1:
 * Layer 1 [z: calc(z-bg - 1)]: .route-bg-fallback (Static 3-stop dark wash gradient)
 * Layer 2 [z: z-bg]:          .route-bg-orb-a/b/c (Three GPU radial glow orbs with Lissajous drift)
 * Layer 3 [z: z-bg]:          .route-bg-video-container (1080p MP4 @ 0.65x speed, saturate 1.28, contrast 1.12)
 * Layer 4 [z: calc(z-bg + 1)]: .route-bg-tint (Linear vertical contrast grade)
 * Layer 5 [z: calc(z-bg + 1)]: .route-bg-shimmer (135° diagonal highlight ramp)
 * Layer 6 [z: calc(z-bg + 2)]: .route-bg-grain (Film grain png, 'grain-dance' 8s) + FluidCanvas
 */
export function RouteBackground() {
  const focusModeEnabled = useFocusMode((s) => s.enabled);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Reduced motion detection
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Video playback speed and keep-alive watchdog
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    // 0.65x speed per DESIGN.md Section 5.1
    video.playbackRate = 0.65;
    video.play().catch(() => {});

    // Keep-alive watchdog interval: recovers from tab switches and low-power decoder stalls
    const watchdogInterval = window.setInterval(() => {
      if (video.paused && !prefersReducedMotion) {
        video.play().catch(() => {});
      }
    }, 2500);

    return () => {
      window.clearInterval(watchdogInterval);
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {/* ── Layer 1: Static Fallback Wash Gradient (z-index: -11) ── */}
      <div className="route-bg-fallback" aria-hidden="true" />

      {/* ── Layer 2: GPU Radial Glow Orbs (z-index: -10) ── */}
      {!prefersReducedMotion && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
          {/* Orb A: Electric Blue Lissajous Drift (22s) */}
          <div className="route-bg-orb route-bg-orb-a animate-wave-canvas-a" />
          {/* Orb B: Mint Green Ambient Glow (28s) */}
          <div className="route-bg-orb route-bg-orb-b animate-wave-canvas-b" />
          {/* Orb C: Canvas Tone Counterbalance (18s) */}
          <div className="route-bg-orb route-bg-orb-c animate-wave-canvas-c" />
        </div>
      )}

      {/* ── Layer 3: GPU Ambient Wave Video Container (z-index: -10) ── */}
      <div
        className="fixed inset-0 overflow-hidden -z-10 route-bg-video-container"
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          id="route-bg-video"
          poster="/background/ps3-wave-poster.webp"
          className="route-bg-video object-cover object-center w-full h-full filter brightness-105 saturate-[1.28] contrast-[1.12]"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src="/background/ps3-wave.1920x1080.mp4" type="video/mp4" />
          <source src="/background/ps3-wave.webm" type="video/webm" />
        </video>
      </div>

      {/* ── Layer 4: Linear Vertical Contrast Grade (z-index: -9) ── */}
      <div className="route-bg-tint" aria-hidden="true" />

      {/* ── Layer 5: 135° Diagonal Highlight Ramp (z-index: -9) ── */}
      <div className="route-bg-shimmer" aria-hidden="true" />

      {/* ── Layer 6: Film Grain Texture ('grain-dance' 8s) & FluidCanvas (z-index: -8) ── */}
      <FluidCanvas />
      <div className="route-bg-grain" aria-hidden="true" />

      {/* ── Focus Mode Scrim ── */}
      {focusModeEnabled && <div className="route-bg-focus-scrim" aria-hidden="true" />}
    </>
  );
}
