'use client';

import { useRef, useState } from 'react';

const VIDEO_STAGE_CONTAINER_CLASS = 'pointer-events-none absolute inset-0 z-0 overflow-hidden';

const VIDEO_ELEMENT_CLASS = 'h-full w-full object-cover object-center opacity-40 saturate-125';

const VIDEO_OVERLAY_CLASS =
  'absolute inset-0 bg-gradient-to-b from-white/75 via-white/60 to-zinc-50/80 backdrop-blur-[1px]';

const PAUSE_BUTTON_CLASS =
  'pointer-events-auto absolute right-3 bottom-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-black/[0.12] bg-white/90 font-mono text-[13px] text-zinc-800 shadow-2xs transition-transform duration-150 hover:-translate-y-px hover:bg-white active:scale-[0.985]';

export function LoginVideoStage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  function handleTogglePlayback() {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      void videoEl.play();
      setIsPaused(false);
      return;
    }

    videoEl.pause();
    setIsPaused(true);
  }

  return (
    <div className={VIDEO_STAGE_CONTAINER_CLASS}>
      <video
        ref={videoRef}
        data-testid="login-aside-mining-video"
        poster="/images/departments/overview.webp"
        className={VIDEO_ELEMENT_CLASS}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        preload="metadata"
      >
        <source src="/images/departments/overview.mp4" type="video/mp4" />
        <source src="/images/departments/plant-inventory.mp4" type="video/mp4" />
      </video>
      <div className={VIDEO_OVERLAY_CLASS} aria-hidden="true" />
      <button
        type="button"
        onClick={handleTogglePlayback}
        aria-label={isPaused ? 'Play background video' : 'Pause background video'}
        title={isPaused ? 'Play background video' : 'Pause background video'}
        data-testid="login-video-pause-toggle"
        className={PAUSE_BUTTON_CLASS}
      >
        <span aria-hidden="true">{isPaused ? '▶' : '❚❚'}</span>
      </button>
    </div>
  );
}
