import { BorderBox } from '@repo/ui/BorderBox';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';

export default function DatabaseLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading database operations">
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded animate-pulse" />
        <div className="h-6 w-40 bg-[var(--bg-secondary)] rounded animate-pulse" />
      </div>

      <Divider variant="fading" label="SUPABASE CLUSTER METRICS" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3].map((idx) => (
          <GlassCard key={idx}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-[var(--bg-secondary)] rounded mt-2 animate-pulse" />
            <div className="h-3 w-32 bg-[var(--bg-tertiary)] rounded mt-1 animate-pulse" />
          </GlassCard>
        ))}

        <BorderBox variant="patterned" padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-[var(--bg-secondary)] rounded mt-2 animate-pulse" />
            <div className="h-3 w-28 bg-[var(--bg-tertiary)] rounded mt-1 animate-pulse" />
          </div>
        </BorderBox>
      </div>

      <div className="h-64 bg-[var(--bg-secondary)] rounded-xl animate-pulse" aria-hidden="true" />
    </div>
  );
}
