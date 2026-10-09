import { GlassCard } from '@repo/ui/GlassCard';

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
      <section className="relative w-full pt-2 pb-2 px-4 sm:px-6">
        <div className="relative w-full overflow-hidden rounded-2xl">
          <SkeletonBlock className="h-[460px] w-full" />
        </div>
        <div className="mt-5 flex items-center justify-between px-1">
          <div className="flex items-center gap-1 liquid-glass-light border border-black/10 shadow-window p-1 rounded-full">
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <SkeletonBlock className="h-1.5 w-6 rounded-full bg-[var(--accent-blue)]" />
            <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
            <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
            <SkeletonBlock className="h-1.5 w-1.5 rounded-full" />
          </div>
        </div>
      </section>

      {/* Executive Dashboard link placeholder */}
      <div className="flex justify-end">
        <SkeletonBlock className="h-7 w-36 rounded-button" />
      </div>

      {/* Department & Operational Testimonials Double Marquee */}
      <div className="space-y-4">
        <header className="w-full rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle backdrop-blur-md shadow-sm px-6 py-2.5 flex items-center justify-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-arch-accent-blue/10 animate-pulse" />
            <div className="h-4 w-64 bg-arch-surface-tertiary rounded animate-pulse" />
          </div>
        </header>
        <div className="relative flex w-full flex-col gap-3 overflow-hidden py-1.5">
          <div className="flex gap-4 sm:gap-6 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-[320px] shrink-0 h-[122px] rounded-2xl bg-white/75 border border-black/[0.08] shadow-card p-4 sm:p-5 flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-arch-surface-tertiary animate-pulse shrink-0" />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="h-3.5 w-24 bg-arch-surface-tertiary rounded animate-pulse" />
                    <div className="h-2.5 w-16 bg-arch-surface-tertiary/70 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="h-2.5 w-full bg-arch-surface-tertiary/60 rounded animate-pulse" />
                  <div className="h-2.5 w-4/5 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 sm:gap-6 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-[320px] shrink-0 h-[122px] rounded-2xl bg-white/75 border border-black/[0.08] shadow-card p-4 sm:p-5 flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-arch-surface-tertiary animate-pulse shrink-0" />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="h-3.5 w-24 bg-arch-surface-tertiary rounded animate-pulse" />
                    <div className="h-2.5 w-16 bg-arch-surface-tertiary/70 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="h-2.5 w-full bg-arch-surface-tertiary/60 rounded animate-pulse" />
                  <div className="h-2.5 w-4/5 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Urgencies & Alerts */}
      <div className="space-y-4">
        <header className="w-full rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle backdrop-blur-md shadow-sm px-6 py-2.5 flex items-center justify-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-accent-red/10 animate-pulse" />
            <div className="h-4 w-72 bg-arch-surface-tertiary rounded animate-pulse" />
          </div>
        </header>
        <div className="w-full flex justify-center">
          <SkeletonBlock className="h-12 w-full max-w-4xl rounded-xl" />
        </div>
      </div>

      {/* Core Operational Modules - Interactive Filtered Grid */}
      <section className="space-y-4 relative rounded-card liquid-glass-light border border-white/20 shadow-window p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-arch-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-arch-accent-blue/10 animate-pulse" />
            <div className="h-5 w-48 bg-arch-surface-tertiary rounded animate-pulse" />
            <div className="h-4 w-12 bg-arch-surface-tertiary rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="h-8 w-60 rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle animate-pulse" />
            <div className="h-8 w-44 rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 auto-rows-fr">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="uiverse-card h-[290px] flex flex-col justify-between">
              <div className="uiverse-card-banner h-[110px] w-full bg-arch-surface-secondary relative flex items-start justify-end p-3.5">
                <div className="w-10 h-10 rounded-full bg-arch-surface-tertiary animate-pulse" />
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 bg-arch-surface-tertiary rounded animate-pulse" />
                    <div className="h-3 w-14 bg-arch-surface-tertiary rounded-full animate-pulse" />
                  </div>
                  <div className="h-3 w-44 bg-arch-surface-tertiary/70 rounded animate-pulse" />
                  <div className="h-6 w-28 rounded-full bg-arch-surface-secondary border border-arch-border-subtle animate-pulse mt-2" />
                </div>
                <div className="pt-2 border-t border-arch-border-subtle flex justify-between items-center">
                  <div className="h-3 w-16 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-arch-surface-tertiary/60 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Active Operational Metrics Charts */}
      <section className="space-y-4 relative rounded-card liquid-glass-light border border-white/20 shadow-window p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-arch-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-arch-accent-blue/10 animate-pulse" />
            <div className="h-5 w-44 bg-arch-surface-tertiary rounded animate-pulse" />
          </div>
        </div>
        <div className="h-40 animate-pulse bg-arch-surface-tertiary rounded-card" />
      </section>

      {/* Industrial Insights & Production Trends */}
      <section className="space-y-4">
        <header className="w-full rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle backdrop-blur-md shadow-sm px-6 py-2.5 flex items-center justify-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-accent-green/10 animate-pulse" />
            <div className="h-4 w-60 bg-arch-surface-tertiary rounded animate-pulse" />
          </div>
        </header>
        <GlassCard
          variant="default"
          padding
          className="bg-arch-surface-secondary/70 border border-arch-border-subtle rounded-card p-5 sm:p-6"
        >
          <div className="h-64 animate-pulse bg-arch-surface-tertiary rounded-card" />
        </GlassCard>
      </section>
    </div>
  );
}
