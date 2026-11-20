const VIDEO_STAGE_CONTAINER_CLASS = 'pointer-events-none absolute inset-0 z-0 overflow-hidden';

const VIDEO_ELEMENT_CLASS =
  'h-full w-full scale-105 object-cover object-center opacity-55 saturate-150 contrast-105 transition-transform duration-1000';

const VIDEO_COLOR_WASH_CLASS =
  'absolute inset-0 bg-gradient-to-br from-amber-500/20 via-white/55 to-emerald-500/20 backdrop-blur-[1px]';

const STRATA_GRID_CLASS =
  'absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_22%_28%,rgba(245,158,11,0.38),transparent_48%),radial-gradient(circle_at_78%_72%,rgba(16,185,129,0.28),transparent_52%)]';

const SCAN_LINE_CLASS =
  'absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent animate-pulse';

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
        preload="auto"
      >
        <source src="/images/departments/drilling.mp4" type="video/mp4" />
        <source src="/images/departments/production.mp4" type="video/mp4" />
        <source src="/images/departments/overview.mp4" type="video/mp4" />
        <source src="/background/video-loop.webm" type="video/webm" />
        <source src="/background/video-loop.mp4" type="video/mp4" />
      </video>
      <div className={VIDEO_COLOR_WASH_CLASS} aria-hidden="true" />
      <div className={STRATA_GRID_CLASS} aria-hidden="true" />
      <div className={SCAN_LINE_CLASS} aria-hidden="true" />
      {/* Animated opencast pit bench beacons */}
      <div
        aria-hidden="true"
        className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full border border-amber-500/35 bg-white/80 px-2.5 py-1 shadow-sm backdrop-blur-md"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
        </span>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        <span className="font-mono font-semibold text-[10px] text-amber-900 uppercase tracking-wider">
          Pit Feed Live
        </span>
      </div>
    </div>
  );
}
