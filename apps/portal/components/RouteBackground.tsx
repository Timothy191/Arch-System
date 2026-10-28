'use client';

import { Suspense, useEffect, useRef, useState } from 'react';

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * RouteBackgroundPoster
 * Renders the primary LCP asset (PS3 Wave desktop + mobile WebP poster) in native color without overlays or filters.
 */
function RouteBackgroundPoster() {
  return (
    <div
      className="route-bg-image-container pointer-events-none fixed inset-0 z-background overflow-hidden"
      aria-hidden="true"
    >
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="/background/global-background-poster-mobile.webp"
          type="image/webp"
        />
        <img
          id="route-bg-light-image"
          src="/background/global-background-poster.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="route-bg-image h-full w-full object-cover object-center"
        />
      </picture>
    </div>
  );
}

/**
 * RouteBackgroundInner
 * Handles progressive enhancement PS3 Wave video loading across desktop (1920x1080)
 * and mobile (720x1280) viewports while respecting accessibility and network constraints.
 */
function RouteBackgroundInner() {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 1. Accessibility: reduced motion check
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    // 2. Network connection constraints (Network Information API)
    const nav = navigator as NavigatorWithConnection;

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

    // 3. Detect desktop vs mobile viewport for optimal PS3 Wave stream selection
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    setIsMobileViewport(mobileQuery.matches);
    const handleViewportChange = (e: MediaQueryListEvent) => {
      setIsMobileViewport(e.matches);
    };
    mobileQuery.addEventListener('change', handleViewportChange);

    // 4. Defer video mounting until browser is idle after LCP
    const loadDeferredVideo = () => {
      setShouldLoadVideo(true);
    };

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(loadDeferredVideo, { timeout: 800 });
      return () => {
        idleWindow.cancelIdleCallback?.(handle);
        mobileQuery.removeEventListener('change', handleViewportChange);
      };
    }

    const timer = setTimeout(loadDeferredVideo, 350);
    return () => {
      clearTimeout(timer);
      mobileQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && shouldLoadVideo) {
      if (videoRef.current.readyState >= 2) {
        setIsVideoLoaded(true);
      }
      videoRef.current.play().catch(() => {});
    }
  }, [shouldLoadVideo, isMobileViewport]);

  const posterSrc = isMobileViewport
    ? '/background/global-background-poster-mobile.webp'
    : '/background/global-background-poster.webp';
  const webmSrc = isMobileViewport
    ? '/background/video-loop-mobile.webm'
    : '/background/video-loop.webm';
  const mp4Src = isMobileViewport
    ? '/background/video-loop-mobile.mp4'
    : '/background/video-loop.mp4';

  return (
    <>
      <RouteBackgroundPoster />

      {/* ── Ambient PS3 Wave Video Background (Desktop & Mobile) ── */}
      {shouldLoadVideo && (
        <div
          className="route-bg-video-container pointer-events-none fixed inset-0 z-route-bg"
          aria-hidden="true"
        >
          <video
            key={isMobileViewport ? 'ps3-wave-mobile' : 'ps3-wave-desktop'}
            id="route-bg-light-video"
            ref={videoRef}
            poster={posterSrc}
            className="route-bg-video h-full w-full object-cover object-center"
            style={{
              opacity: isVideoLoaded ? 1 : 0,
              transition: 'opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'opacity',
            }}
            onLoadedData={() => setIsVideoLoaded(true)}
            onCanPlay={() => setIsVideoLoaded(true)}
            onError={() => setIsVideoLoaded(false)}
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            preload="auto"
          >
            {/* 1. High-performance VP9 hardware-accelerated stream */}
            <source src={webmSrc} type="video/webm; codecs=vp09.00.41.08" />
            {/* 2. Universal H.264 MP4 fallback for Safari/iOS */}
            <source src={mp4Src} type="video/mp4" />
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
