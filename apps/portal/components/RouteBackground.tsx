"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useFocusMode } from "@/hooks/useFocusMode";

/**
 * RouteBackground
 *
 * Renders the full-screen ambient background beneath all portal content with
 * improved performance and accessibility features.
 *
 * Layer stack (back → front, all z-index: -10 to -9):
 *   -10  │ <video>          – /background/837668e02b8cc6414cd7a78c19d1746c.webm (ambient loop)
 *   -10  │ <img> (poster)   – poster image while video loads (fallback)
 *    -9  │ tint overlay     – bg-white/55 glass wash (always visible)
 *
 * Performance optimizations:
 *  • Lazy loading with preload="none" prevents eager resource fetch
 *  • Poster images shown during video load prevent blank screens
 *  • Videos only start loading when document is visible (Intersection Observer)
 *  • A single <video> element is shared between light and focus mode — the
 *    className is swapped when focus mode toggles, so only ONE 22 MB webm is
 *    ever downloaded (previously two identical videos were both loaded,
 *    doubling video bandwidth on every page load).
 *
 * Accessibility features:
 *  • Respects prefers-reduced-motion via reduced-motion state
 *  • Graceful degradation with poster image fallback
 *  • ARIA-hidden for screen readers (decorative content)
 *  • PlaysInline for mobile compatibility
 *
 * Notes:
 *  • `data-bg-mode` is set on <html> by useFocusMode's effect; CSS
 *    selectors in glass.css use it to swap visibility & tint.
 *  • backdrop-blur is NOT applied to the tint overlay — browsers cannot
 *    blur a composited <video> layer and the property would create an
 *    extra compositor layer for zero visual benefit.
 *  • will-change: transform on the videos promotes them to their own
 *    layers immediately, preventing re-paint on first frame.
 */
export function RouteBackground() {
  // Subscribe to keep the component re-rendering on toggle. The actual
  // visibility is controlled via the `data-bg-mode` attribute on <html>,
  // set by useFocusMode — see glass.css `.route-bg-focus-video` rules.
  const focusModeEnabled = useFocusMode((s) => s.enabled);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Lazy load the shared video when it comes into viewport
  useEffect(() => {
    if (prefersReducedMotion) {
      // Don't load videos if user prefers reduced motion
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Start loading and playing the video when in viewport
            video.load();
            // Browsers require an explicit play() call when using preload="none"
            video.play().catch(() => {
              // Ignore autoplay preventions
            });
            observer.unobserve(video);
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(video);

    return () => {
      observer.unobserve(video);
    };
  }, [prefersReducedMotion]);

  // Track video load state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setVideoLoaded(true);

    video.addEventListener("canplay", handleCanPlay);
    return () => video.removeEventListener("canplay", handleCanPlay);
  }, []);

  const containerClass = focusModeEnabled
    ? "route-bg-focus-video-container"
    : "route-bg-video-container";
  const videoClass = focusModeEnabled ? "route-bg-focus-video" : "route-bg-video";

  return (
    <>
      {prefersReducedMotion ? (
        // For users who prefer reduced motion, show static gradient only
        <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
          <div className="w-full h-full bg-gradient-to-br from-white/80 to-white/60" />
        </div>
      ) : (
        <>
          {/* ── Single ambient video — shared between light and focus mode.
               The className swap on the same element keeps the decoder warm
               (no re-fetch/re-decode on toggle) while only ever downloading
               one copy of the webm. ── */}
          <div className={containerClass} aria-hidden="true">
            <video
              ref={videoRef}
              id="route-bg-light-video"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/auth-bg-poster.jpg"
              className={videoClass}
            >
              {/* AGENT-TRACE: Global background video */}
              <source src="/background/837668e02b8cc6414cd7a78c19d1746c.webm" type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* ── Poster fallback overlay — shown until the video loads ── */}
          {!videoLoaded && (
            <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
              <Image src="/auth-bg-poster.jpg" alt="" fill priority className="object-cover" />
            </div>
          )}

          {/* ── Static gradient fallback — hidden by default, shown by
               .low-perf-fallback when video containers are display:none.
               Uses the same canvas-gradient token as route-bg-canvas. ── */}
          <div className="route-bg-fallback" aria-hidden="true" />
        </>
      )}

      {/* ── Tint overlay — always visible for legibility scrim ── */}
      <div className="route-bg-tint" aria-hidden="true" />

      {/* ── Ambient Film Grain overlay — masks banding and adds crisp visual texture ── */}
      <div className="route-bg-grain" aria-hidden="true" />

      {/* ── Focus scrim — only painted when focus mode is active ── */}
      <div className="route-bg-focus-scrim" aria-hidden="true" />
    </>
  );
}
