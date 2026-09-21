"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RouteBackground
 *
 * Renders the full-screen macOS-style wallpaper background beneath all portal
 * content across all server pages. Uses the small WebP poster as the LCP asset
 * and defers the heavier video to a lazy, off-critical-path element.
 */
export function RouteBackground() {
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
      {/* ── LCP background: preloaded compressed WebP poster ── */}
      {/* AGENT-TRACE: 86 KB WebP poster is the critical LCP asset. Heavier video is lazy/deferred. */}
      <div
        className="fixed inset-0 overflow-hidden -z-10 route-bg-image-container"
        aria-hidden="true"
      >
        <img
          id="route-bg-light-image"
          src="/background/edge-of-the-event-horizon-poster.webp"
          alt=""
          className="route-bg-image object-cover object-center w-full h-full filter brightness-105"
        />
      </div>

      {/* ── Ambient Video Background ── */}
      {!prefersReducedMotion && (
        <div className="route-bg-video-container" aria-hidden="true">
          <video
            ref={videoRef}
            src="/background/edge-of-the-event-horizon.3840x2160.mp4"
            className="route-bg-video filter brightness-105"
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
          />
        </div>
      )}

      {/* ── Ambient Film Grain overlay ── */}
      <div className="route-bg-grain" aria-hidden="true" />
    </>
  );
}
