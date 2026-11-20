import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';

const SKELETON_CARD_IDS = ['slide', 'docs', 'architecture', 'pdf'] as const;

export default function PresentationLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading presentation">
      <div className="flex items-center justify-between">
        <div className="h-8 w-72 animate-pulse rounded bg-[var(--bg-secondary)]" />
        <div className="h-7 w-44 animate-pulse rounded bg-[var(--bg-secondary)]" />
      </div>

      <Divider variant="fading" label="EXECUTIVE BRIEFING & DOCUMENTATION" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {SKELETON_CARD_IDS.map((id) => (
          <GlassCard key={id}>
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[var(--bg-secondary)]" />
            <div className="mt-1 h-3 w-32 animate-pulse rounded bg-[var(--bg-tertiary)]" />
          </GlassCard>
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-xl bg-[var(--bg-secondary)]" aria-hidden="true" />
    </div>
  );
}
