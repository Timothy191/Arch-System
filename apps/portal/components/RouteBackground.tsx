"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

import dynamic from "next/dynamic";

const FluidCanvas = dynamic(() => import("@repo/ui/FluidCanvas").then((mod) => mod.FluidCanvas), {
  ssr: false,
});

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
        className="fixed inset-0 overflow-hidden -z-10 route-bg-image-container"
        aria-hidden="true"
      >
        <img
          id="route-bg-light-image"
          src="/background/macos-27-golden-4480x3088-26626.png"
          alt="macOS Golden Background"
          className="route-bg-image object-cover object-center w-full h-full filter brightness-105"
        />
      </div>

      {/* ── Ambient Film Grain overlay ── */}
      <FluidCanvas />
      <div className="route-bg-grain" aria-hidden="true" />

      {/* ── Focus Mode Scrim ── */}
      {focusModeEnabled && <div className="route-bg-focus-scrim" aria-hidden="true" />}
    </>
  );
}
