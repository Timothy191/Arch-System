"use client";

import { useEffect, useRef, useState } from "react";
import { GLOBAL_BACKGROUND_VIDEO, GLOBAL_BACKGROUND_VIDEO_WEBM } from "@repo/theme";

/**
 * AuthAmbientBackground — decoupled WebM/MP4 loop for auth routes only.
 * Runs in its own compositor layer; does not affect taskbar or login panel layout.
 */
export function AuthAmbientBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPrefersReducedMotion(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion) {
      return;
    }
    video.load();
    const play = () => {
      void video.play().catch(() => {
        /* autoplay policy — poster/gradient remains */
      });
    };
    video.addEventListener("canplay", play);
    return () => video.removeEventListener("canplay", play);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div className="portal-layer-bg portal-layer-bg--static" aria-hidden="true">
        <div className="route-bg-fallback route-bg-fallback--auth" />
        <div className="route-bg-tint route-bg-tint--auth" />
      </div>
    );
  }

  return (
    <div className="portal-layer-bg" aria-hidden="true" data-layer="ambient-video">
      <div className="route-bg-fallback route-bg-fallback--reserve route-bg-fallback--auth" />
      <div className="route-bg-video-container route-bg-video-container--auth">
        <video
          ref={videoRef}
          id="auth-ambient-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="route-bg-video route-bg-video--auth"
        >
          <source src={GLOBAL_BACKGROUND_VIDEO_WEBM} type="video/webm" />
          <source src={GLOBAL_BACKGROUND_VIDEO} type="video/mp4" />
        </video>
      </div>
      <div className="route-bg-tint route-bg-tint--auth" />
      <div className="route-bg-grain route-bg-grain--auth" />
    </div>
  );
}
