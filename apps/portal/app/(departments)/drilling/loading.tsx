import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';

export default function DrillingLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading drilling operations">
      <div className="flex items-center justify-between">
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--bg-secondary)]" />
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--bg-secondary)]" />
      </div>

      <Divider variant="fading" label="REAL-TIME OPERATIONS" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="mt-2 h-8 w-32 animate-pulse rounded bg-[var(--bg-secondary)]" />
          <div className="mt-1 h-3 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[var(--bg-secondary)]" />
          <div className="mt-1 h-3 w-28 animate-pulse rounded bg-[var(--bg-tertiary)]" />
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[var(--bg-secondary)]" />
        </GlassCard>

        <BorderBox variant="patterned-caution" padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            </div>
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[var(--bg-secondary)]" />
            <div className="mt-1 h-3 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </div>
        </BorderBox>
      </div>
    </div>
  );
}
