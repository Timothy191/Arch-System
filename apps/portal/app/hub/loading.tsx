function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-arch-surface-tertiary rounded-2xl ${className ?? ''}`} />
  );
}

export default function HubLoading() {
  return (
    <div
      className="space-y-8 sm:space-y-10 w-full"
      aria-busy="true"
      aria-label="Loading Operations Hub"
    >
      {/* Light-theme glass hero section */}
      <section className="relative w-full pt-2 pb-2 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="relative w-full py-4">
          <div className="mx-auto w-[84%] sm:w-[78%] lg:w-[68%] max-w-[760px] overflow-hidden rounded-2xl liquid-glass-light border border-white/20 shadow-window">
            <SkeletonBlock className="h-[460px] w-full" />
          </div>
          <div className="mt-5 flex items-center justify-center px-1">
            <div className="flex items-center gap-1.5">
              <SkeletonBlock className="h-1.5 w-6 rounded-full bg-[var(--accent-blue)]" />
              <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
              <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
              <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Core Operational Modules - Primary Workspace Above the Fold */}
      <section className="space-y-5 relative rounded-card liquid-glass-light border border-white/45 ring-1 ring-inset ring-white/75 shadow-window p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-arch-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-arch-accent-blue/10 animate-pulse" />
            <div className="h-5 w-48 bg-arch-surface-tertiary rounded animate-pulse" />
            <div className="h-5 w-12 bg-arch-surface-tertiary rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="h-8 w-60 rounded-full bg-white/85 border border-arch-border-subtle animate-pulse" />
            <div className="h-8 w-44 rounded-full bg-arch-surface-secondary/85 border border-arch-border-subtle animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 auto-rows-fr">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="uiverse-card h-[250px] flex flex-col justify-between">
              <div className="uiverse-card-banner h-[110px] w-full bg-arch-surface-secondary relative flex items-start justify-end p-3.5">
                <div className="w-8 h-8 rounded-lg bg-arch-surface-tertiary animate-pulse" />
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 bg-arch-surface-tertiary rounded animate-pulse" />
                    <div className="h-4 w-14 bg-arch-surface-tertiary rounded-full animate-pulse" />
                  </div>
                  <div className="h-3 w-44 bg-arch-surface-tertiary/70 rounded animate-pulse" />
                </div>
                <div className="pt-2 border-t border-arch-border-subtle flex justify-between items-center">
                  <div className="h-3 w-16 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active metrics chart placeholder */}
        <div className="mt-4 h-40 w-full bg-arch-surface-tertiary rounded animate-pulse" />

        {/* Operational telemetry card placeholder */}
        <div className="mt-4 h-64 w-full bg-arch-surface-tertiary rounded animate-pulse" />
      </section>
    </div>
  );
}
