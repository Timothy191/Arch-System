function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-arch-surface-tertiary ${className ?? ''}`} />
  );
}

export default function HubLoading() {
  return (
    <div
      className="w-full space-y-8 sm:space-y-10"
      aria-busy="true"
      aria-label="Loading Operations Hub"
    >
      {/* Light-theme glass hero section */}
      <section className="relative mx-auto w-full px-4 pt-2 pb-2 sm:px-6">
        <div className="relative w-full py-4">
          <div className="liquid-glass-light mx-auto w-[92%] max-w-[1060px] overflow-hidden rounded-2xl border border-white/20 shadow-window sm:w-[88%] lg:w-[82%]">
            <SkeletonBlock className="h-[460px] w-full" />
          </div>
          <div className="mt-5 flex items-center justify-center px-1">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-3.5 w-3.5 rounded-sm bg-[var(--accent-blue)] opacity-80" />
              <SkeletonBlock className="h-2.5 w-2.5 rounded-sm opacity-40" />
              <SkeletonBlock className="h-2.5 w-2.5 rounded-sm opacity-40" />
              <SkeletonBlock className="h-2.5 w-2.5 rounded-sm opacity-40" />
            </div>
          </div>
        </div>
      </section>

      {/* Core Operational Modules - Primary Workspace Above the Fold */}
      <section className="liquid-glass-light relative space-y-5 rounded-card border border-white/45 p-4 shadow-window ring-1 ring-white/75 ring-inset sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-arch-border-subtle border-b pb-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 animate-pulse rounded-lg bg-arch-accent-blue/10" />
            <div className="h-5 w-48 animate-pulse rounded bg-arch-surface-tertiary" />
            <div className="h-5 w-12 animate-pulse rounded-full bg-arch-surface-tertiary" />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="h-8 w-60 animate-pulse rounded-full border border-arch-border-subtle bg-white/85" />
            <div className="h-8 w-44 animate-pulse rounded-full border border-arch-border-subtle bg-arch-surface-secondary/85" />
          </div>
        </div>
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="uiverse-card flex h-[250px] flex-col justify-between">
              <div className="uiverse-card-banner relative flex h-[110px] w-full items-start justify-end bg-arch-surface-secondary p-3.5">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-arch-surface-tertiary" />
              </div>
              <div className="flex flex-1 flex-col justify-between space-y-3 p-4 sm:p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 animate-pulse rounded bg-arch-surface-tertiary" />
                    <div className="h-4 w-14 animate-pulse rounded-full bg-arch-surface-tertiary" />
                  </div>
                  <div className="h-3 w-44 animate-pulse rounded bg-arch-surface-tertiary/70" />
                </div>
                <div className="flex items-center justify-between border-arch-border-subtle border-t pt-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-arch-surface-tertiary/60" />
                  <div className="h-3 w-20 animate-pulse rounded bg-arch-surface-tertiary/60" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active metrics chart placeholder */}
        <div className="mt-4 h-40 w-full animate-pulse rounded bg-arch-surface-tertiary" />

        {/* Operational telemetry card placeholder */}
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-arch-surface-tertiary" />
      </section>
    </div>
  );
}
