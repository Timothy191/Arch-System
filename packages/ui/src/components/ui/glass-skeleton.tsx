import { cn } from '@repo/ui/lib/utils';

interface GlassSkeletonProps {
  className?: string;
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  heights?: string[];
}

const DEFAULT_HEIGHTS = ['h-3', 'h-8', 'h-3'];
const DEFAULT_WIDTHS = ['w-24', 'w-16', 'w-32'];

export function GlassSkeleton({
  className,
  rows = 3,
  columns = 1,
  showHeader = false,
  heights = DEFAULT_HEIGHTS,
}: GlassSkeletonProps) {
  const totalPills = rows * columns;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card',
        'border border-[var(--glass-border)] border-t-white/95',
        'bg-white/40 saturate-[160%] backdrop-blur-xl',
        className
      )}
      style={{ boxShadow: 'var(--refraction-edge-light)' }}
    >
      {/* Ambient shimmer sweep — silver core, 12s diagonal */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden motion-reduce:hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            background: `linear-gradient(
              105deg,
              transparent 30%,
              rgba(255, 255, 255, 0.12) 45%,
              rgba(210, 210, 215, 0.08) 50%,
              rgba(255, 255, 255, 0.12) 55%,
              transparent 70%
            )`,
            transform: 'translateX(-100%) skewX(-12deg)',
            animation: 'glass-shimmer-ambient 12s ease-in-out infinite var(--shimmer-delay, 0s)',
          }}
        />
      </div>

      <div className="relative z-10 space-y-3 p-5">
        {showHeader && (
          <>
            <div className="h-8 w-48 rounded bg-[var(--bg-tertiary)]/60" />
            <div className="h-4 w-96 rounded bg-[var(--bg-tertiary)]/60" />
          </>
        )}
        {Array.from({ length: totalPills }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded bg-[var(--bg-tertiary)]/60',
              heights[i % heights.length],
              DEFAULT_WIDTHS[i % DEFAULT_WIDTHS.length]
            )}
          />
        ))}
      </div>
    </div>
  );
}

export type { GlassSkeletonProps };
