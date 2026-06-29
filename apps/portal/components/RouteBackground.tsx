"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GLOBAL_BACKGROUND_VIDEO } from "@repo/theme";
import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * RouteBackground
 *
 * Renders the full-screen ambient background beneath all portal content.
 * Uses the single canonical MP4 from `shared/background/white-geometric-waves.3840x2160.mp4`.
 */
export function RouteBackground() {
  useFocusMode((s) => s.enabled);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion) {
      return;
    }

    const handleCanPlay = () => setVideoLoaded(true);

    video.addEventListener("canplay", handleCanPlay);
    video.load();

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {prefersReducedMotion ? (
        <div className="route-bg-fallback" aria-hidden="true" />
      ) : (
        <>
          <div className="route-bg-fallback route-bg-fallback--reserve" aria-hidden="true" />
          <div className="route-bg-video-container" aria-hidden="true">
            <video
              ref={videoRef}
              id="route-bg-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/auth-bg-poster.jpg"
              className="route-bg-video"
            >
              <source src={GLOBAL_BACKGROUND_VIDEO} type="video/mp4" />
            </video>
          </div>

          {!videoLoaded && (
            <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
              <Image src="/auth-bg-poster.jpg" alt="" fill priority className="object-cover" />
            </div>
          )}
        </>
      )}

      <div className="route-bg-tint" aria-hidden="true" />
      <div className="route-bg-grain" aria-hidden="true" />
      <div className="route-bg-focus-scrim" aria-hidden="true" />
    </>
  );
}
