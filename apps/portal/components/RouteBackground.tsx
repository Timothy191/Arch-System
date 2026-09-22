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

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current && !prefersReducedMotion) {
      // Sometimes onCanPlay doesn't fire if the video is already ready or cached,
      // so we check readyState.
      if (videoRef.current.readyState >= 3) {
        setIsVideoLoaded(true);
      }
      videoRef.current.play().catch(() => {});
    }
  }, [prefersReducedMotion]);

  return (
    <>
      {/* ── LCP background: preloaded compressed WebP poster ── */}
      {/* AGENT-TRACE: 86 KB WebP poster is the critical LCP asset. Heavier video is lazy/deferred. */}
      <div
        className="fixed inset-0 overflow-hidden -z-10 route-bg-image-container pointer-events-none"
        aria-hidden="true"
      >
        <img
          id="route-bg-light-image"
          src="/background/earth-orbit-poster.webp"
          alt=""
          className="route-bg-image object-cover object-center w-full h-full filter brightness-105"
        />
      </div>

      {/* ── Ambient Video Background ── */}
      {!prefersReducedMotion && (
        <div
          className="route-bg-video-container fixed inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
        >
          <video
            ref={videoRef}
            src="/background/global-background.mp4"
            className="route-bg-video filter brightness-105 object-cover object-center w-full h-full"
            style={{
              opacity: isVideoLoaded ? 1 : 0,
              transition: "opacity 1.5s ease-in-out",
              willChange: "transform, opacity",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
            onCanPlay={() => setIsVideoLoaded(true)}
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            preload="auto"
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* ── Ambient Film Grain overlay ── */}
      <div className="route-bg-grain" aria-hidden="true" />
    </>
  );
}
