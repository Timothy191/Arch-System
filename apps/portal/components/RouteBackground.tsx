'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

/**
 * RouteBackgroundPoster
 * Renders the primary LCP asset (94 KB WebP poster) and film grain overlay.
 */
function RouteBackgroundPoster() {
  return (
    <>
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
          className="route-bg-image object-cover object-center filter invert brightness-75 contrast-125"
        />
      </div>
      <div className="route-bg-grain" aria-hidden="true" />
    </>
  );
}

/**
 * RouteBackgroundInner
 * Handles progressive enhancement video loading based on route, device, and network constraints.
 */
function RouteBackgroundInner() {
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
      <RouteBackgroundPoster />

      {/* ── Ambient Video Background (Deferred / Constrained-Safe) ── */}
      {shouldLoadVideo && (
        <div
          className="route-bg-video-container fixed inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
        >
          <video
            id="route-bg-light-video"
            ref={videoRef}
            className="route-bg-video filter invert brightness-75 contrast-125 object-cover object-center w-full h-full"
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
            {/* biome-ignore format: Cloudinary CDN URLs naturally exceed line width */}
            <source src="/background/video-loop.webm" type="video/webm" />
            {/* biome-ignore format: Cloudinary CDN URLs naturally exceed line width */}
            <source src="/background/video-loop.mp4" type="video/mp4" />
          </video>
        </div>
      )}
    </>
  );
}

/**
 * RouteBackground
 * Suspense-wrapped boundary to isolate dynamic usePathname from SSR prerender tree.
 */
export function RouteBackground() {
  return (
    <Suspense fallback={<RouteBackgroundPoster />}>
      <RouteBackgroundInner />
    </Suspense>
  );
}
