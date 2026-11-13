const VIDEO_STAGE_CONTAINER_CLASS = 'pointer-events-none absolute inset-0 z-0 overflow-hidden';

const VIDEO_ELEMENT_CLASS = 'h-full w-full object-cover object-center opacity-40 saturate-125';

const VIDEO_OVERLAY_CLASS =
  'absolute inset-0 bg-gradient-to-b from-white/75 via-white/60 to-zinc-50/80 backdrop-blur-[1px]';

export function LoginVideoStage() {
  return (
    <div className={VIDEO_STAGE_CONTAINER_CLASS}>
      <video
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
    </div>
  );
}
