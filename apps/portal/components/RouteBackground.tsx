'use client';

import { Suspense, useEffect, useRef } from 'react';

const BACKGROUND_VIDEO_SRC = '/background/global-background.mp4';

/**
 * RouteBackgroundInner
 * Renders the single global ambient background video as-is across all viewports.
 */
function RouteBackgroundInner() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    // Imperatively set defaultMuted + muted + playsInline before play() for browser autoplay policies
    videoEl.defaultMuted = true;
    videoEl.muted = true;
    videoEl.playsInline = true;

    const startPlayback = () => {
      videoEl.play().catch(() => {});
    };

    startPlayback();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        videoEl.pause();
        return;
      }
      startPlayback();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      className="route-bg-video-container pointer-events-none fixed inset-0 z-route-bg"
      aria-hidden="true"
    >
      <video
        id="route-bg-light-video"
        ref={videoRef}
        src={BACKGROUND_VIDEO_SRC}
        className="route-bg-video h-full w-full object-cover object-center"
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        preload="auto"
      >
        <source src={BACKGROUND_VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}

/**
 * RouteBackground
 * Suspense-wrapped boundary to isolate background rendering from SSR prerender tree.
 */
export function RouteBackground() {
  return (
    <Suspense fallback={null}>
      <RouteBackgroundInner />
    </Suspense>
  );
}
