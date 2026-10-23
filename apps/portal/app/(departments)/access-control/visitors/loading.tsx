import { GlassCard } from '@repo/ui/GlassCard';

export default function VisitorsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Registration Form Skeleton (Left, 1 col) */}
        <div className="lg:col-span-1">
          <GlassCard>
            <div className="mb-6 flex items-center space-x-2">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--bg-tertiary)]/60" />
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
            </div>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
                  <div className="h-10 w-full animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
                </div>
              ))}
              <div className="pt-4">
                <div className="h-10 w-full animate-pulse rounded bg-[var(--bg-tertiary)]/80" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Active Visitors Table Skeleton (Right, 2 cols) */}
        <div className="lg:col-span-2">
          <GlassCard className="h-full overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
              <div className="h-5 w-40 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
            </div>
            <div className="p-0">
              <div className="border-[var(--border-default)] border-b">
                <div className="grid grid-cols-5 gap-4 p-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
                  ))}
                </div>
              </div>
              <div className="divide-y divide-[var(--border-default)]/50">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                  <div key={row} className="grid grid-cols-5 gap-4 p-4">
                    <div className="col-span-1 h-4 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
                    <div className="col-span-1 h-4 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
                    <div className="col-span-1 h-4 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
                    <div className="col-span-1 h-4 animate-pulse rounded bg-[var(--bg-tertiary)]/40" />
                    <div className="col-span-1 ml-auto h-4 w-16 animate-pulse rounded bg-[var(--bg-tertiary)]/60" />
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
