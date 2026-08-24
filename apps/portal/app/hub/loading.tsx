// AGENT-TRACE: Hub-specific skeleton mirrors the actual page layout sections
// (hero, alerts, module grid, tools, chart) instead of generic rows.

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-arch-surface-tertiary rounded-2xl ${className ?? ""}`} />
  );
}

export default function HubLoading() {
  return (
    <div className="space-y-8 sm:space-y-10 w-full">
      {/* Hero section skeleton */}
      <section className="relative w-full pt-2 pb-2 px-4 sm:px-6">
        <SkeletonBlock className="h-[clamp(380px,48vw,560px)] w-full" />
        <div className="flex items-center justify-center gap-2 mt-5">
          <SkeletonBlock className="h-1.5 w-6 rounded-full" />
          <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
          <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
        </div>
      </section>

      {/* Department reviews skeleton */}
      <SkeletonBlock className="h-24 w-full" />

      {/* Alerts skeleton */}
      <div className="space-y-4">
        <SkeletonBlock className="h-6 w-64" />
        <SkeletonBlock className="h-[120px] w-full" />
      </div>

      {/* Core operational modules skeleton */}
      <div className="space-y-4">
        <SkeletonBlock className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>

      {/* Tools skeleton */}
      <SkeletonBlock className="h-28 w-full" />

      {/* Production trend skeleton */}
      <div className="space-y-4">
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="h-72 w-full" />
      </div>
    </div>
  );
}
