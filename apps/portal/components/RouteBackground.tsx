'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * RouteBackground
 *
 * Renders the full-screen macOS-style wallpaper background beneath all portal
 * content across all server pages.
 *
 * Performance Architecture:
 * 1. Uses the lightweight 94 KB WebP poster as the primary LCP asset.
 * 2. Defers the optimized MP4/WebM video off the critical path using requestIdleCallback.
 * 3. Bypasses video completely when:
 *    - User is on auth route (`/login`) to maximize Speed Index and zero main-thread decode work
 *    - User prefers reduced motion (`prefers-reduced-motion: reduce`)
 *    - User is on mobile device (viewport width < 768px)
 *    - Network connection is constrained (Save-Data mode or 2G/3G "lie-fi" links)
 * 4. Multi-format progressive enhancement: delivers WebM (VP9) with MP4 (H.264, 982 KB) fallback.
 * 5. Sets preload="none" to prevent automatic massive background data downloads.
 */
export function RouteBackground() {
  const pathname = usePathname();
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 0. Auth route bypass: login screen does not render video wallpaper
    if (pathname === '/login' || pathname?.startsWith('/login')) {
      setShouldLoadVideo(false);
      return;
    }

    // 1. Accessibility: reduced motion check
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    // 2. Viewport: mobile devices do not render video wallpaper to save battery/data
    if (window.innerWidth < 768) {
      return;
    }

    // 3. Network connection constraints (Network Information API)
    const nav = navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    };

    if (nav.connection) {
      if (nav.connection.saveData) {
        return;
      }
      if (
        nav.connection.effectiveType === 'slow-2g' ||
        nav.connection.effectiveType === '2g' ||
        nav.connection.effectiveType === '3g'
      ) {
        return;
      }
    }

    // 4. Defer video mounting until browser is idle after LCP
    const loadDeferredVideo = () => {
      setShouldLoadVideo(true);
    };

    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(loadDeferredVideo, { timeout: 3500 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(loadDeferredVideo, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  useEffect(() => {
    if (videoRef.current && shouldLoadVideo) {
      if (videoRef.current.readyState >= 3) {
        setIsVideoLoaded(true);
      }
      videoRef.current.play().catch(() => {});
    }
  }, [shouldLoadVideo]);

  return (
    <>
      {/* ── LCP background: preloaded compressed WebP poster (94 KB) ── */}
      <div
        className="fixed inset-0 overflow-hidden -z-10 route-bg-image-container pointer-events-none"
        aria-hidden="true"
      >
        <Image
          id="route-bg-light-image"
          src="/background/global-background-poster.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="route-bg-image object-cover object-center filter brightness-105"
        />
      </div>

      {/* ── Ambient Video Background (Deferred / Constrained-Safe) ── */}
      {shouldLoadVideo && (
        <div
          className="route-bg-video-container fixed inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
        >
          <video
            id="route-bg-light-video"
            ref={videoRef}
            src="/background/global-background.mp4"
            className="route-bg-video filter brightness-105 object-cover object-center w-full h-full"
            style={{
              opacity: isVideoLoaded ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
            onCanPlay={() => setIsVideoLoaded(true)}
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            preload="none"
            crossOrigin="anonymous"
          >
            <source src="/background/global-background.webm" type="video/webm" />
            <source src="/background/global-background.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* ── Ambient Film Grain overlay ── */}
      <div className="route-bg-grain" aria-hidden="true" />
    </>
  );
}
