"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  // Removed focus mode subscription as we now use a single global background.

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

    if (videoRef.current) observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, [prefersReducedMotion]);

  // Track video load states
  useEffect(() => {
    const video = videoRef.current;

    const handleCanPlay = () => setVideoLoaded(true);

    if (video) video.addEventListener("canplay", handleCanPlay);

    return () => {
      if (video) video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  // Performance-optimized 3D parallax effect on mouse movement
  useEffect(() => {
    if (prefersReducedMotion) return;

    let requestId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      // Calculate offset from center (-0.5 to 0.5) and multiply by factor.
      // Negative multipliers move the background opposite to the cursor, creating depth.
      targetX = (clientX / innerWidth - 0.5) * -30;
      targetY = (clientY / innerHeight - 0.5) * -30;
    };

    const updateParallax = () => {
      // Linear interpolation (lerp) for smooth gliding transition
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      if (videoRef.current) {
        videoRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0px) scale(1.08)`;
      }

      requestId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener("mousemove", handleMouseMove);
    requestId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(requestId);
    };
  }, [prefersReducedMotion, videoLoaded]);

  return (
    <>
      {prefersReducedMotion ? (
        // For users who prefer reduced motion, show static gradient only
        <div className="fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
          <div className="w-full h-full bg-gradient-to-br from-white/80 to-white/60" />
        </div>
      ) : (
        <>
          {/* ── One True Global Background ── */}
          <div className="fixed inset-0 overflow-hidden -z-10 bg-black" aria-hidden="true">
            <video
              ref={videoRef}
              id="global-background-video"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/auth-bg-poster.jpg"
              className="w-full h-full object-cover opacity-80 mix-blend-screen"
              style={{ willChange: "transform", transform: "scale(1.08)" }}
            >
              <source src="/background/837668e02b8cc6414cd7a78c19d1746c.webm" type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* ── Poster fallback overlay — shown until videos load ── */}
          {!videoLoaded && (
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
