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
 *   -10  │ <video>          – background/light-mode/light mode.mp4 (light mode, ambient loop)
 *   -10  │ <video>          – background/focused-mode/focused mode.mp4 (focus mode, ambient loop)
 *   -10  │ <img> (poster)   – poster image while video loads (fallback)
 *    -9  │ tint overlay     – bg-white/55 glass wash (always visible)
 *
 * Performance optimizations:
 *  • Lazy loading with preload="none" prevents eager resource fetch
 *  • Poster images shown during video load prevent blank screens
 *  • Videos only start loading when document is visible (Intersection Observer)
 *  • Both videos ALWAYS mounted to keep decoder warm for instant mode switching
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
  useFocusMode((s) => s.enabled);

  const lightVideoRef = useRef<HTMLVideoElement>(null);
  const focusVideoRef = useRef<HTMLVideoElement>(null);

  const [lightVideoLoaded, setLightVideoLoaded] = useState(false);
  const [focusVideoLoaded, setFocusVideoLoaded] = useState(false);
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

  // Lazy load videos when they come into viewport
  useEffect(() => {
    if (prefersReducedMotion) {
      // Don't load videos if user prefers reduced motion
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            // Start loading the video when in viewport
            video.load();
            observer.unobserve(video);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (lightVideoRef.current) observer.observe(lightVideoRef.current);
    if (focusVideoRef.current) observer.observe(focusVideoRef.current);

    return () => {
      if (lightVideoRef.current) observer.unobserve(lightVideoRef.current);
      if (focusVideoRef.current) observer.unobserve(focusVideoRef.current);
    };
  }, [prefersReducedMotion]);

  // Track video load states
  useEffect(() => {
    const lightVideo = lightVideoRef.current;
    const focusVideo = focusVideoRef.current;

    const handleLightCanPlay = () => setLightVideoLoaded(true);
    const handleFocusCanPlay = () => setFocusVideoLoaded(true);

    if (lightVideo) lightVideo.addEventListener("canplay", handleLightCanPlay);
    if (focusVideo) focusVideo.addEventListener("canplay", handleFocusCanPlay);

    return () => {
      if (lightVideo) lightVideo.removeEventListener("canplay", handleLightCanPlay);
      if (focusVideo) focusVideo.removeEventListener("canplay", handleFocusCanPlay);
    };
  }, []);

  return (
    <>
      {prefersReducedMotion ? (
        // For users who prefer reduced motion, show static gradient only
        <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
          <div className="w-full h-full bg-gradient-to-br from-white/80 to-white/60" />
        </div>
      ) : (
        <>
          {/* ── Light mode: loop the user's video background (lazy-loaded) ── */}
          <div className="route-bg-video-container" aria-hidden="true">
            <video
              ref={lightVideoRef}
              id="route-bg-light-video"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/auth-bg-poster.jpg"
              className="route-bg-video"
            >
              {/* AGENT-TRACE: Global light-mode background video relocated to a subfolder to match monorepo asset organization standard */}
              <source src="/background/light-mode/light-mode.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* ── Focus mode: full-screen atmospheric video (lazy-loaded) ── */}
          <div className="route-bg-focus-video-container" aria-hidden="true">
            <video
              ref={focusVideoRef}
              id="route-bg-focus-video"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/auth-bg-poster.jpg"
              className="route-bg-focus-video"
            >
              <source src="/background/focused-mode/focused-mode.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* ── Poster fallback overlay — shown until videos load ── */}
          {!lightVideoLoaded && !focusVideoLoaded && (
            <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
              <Image src="/auth-bg-poster.jpg" alt="" fill priority className="object-cover" />
            </div>
          )}
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
