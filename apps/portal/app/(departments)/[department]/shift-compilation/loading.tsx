import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { GlassCard } from '@repo/ui/GlassCard';

export default function ShiftCompilationLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <GlassCard className="flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-32" />
        </div>
      </GlassCard>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="space-y-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </GlassCard>
        ))}
      </div>

      {/* Production Card Skeleton */}
      <GlassCard className="space-y-4 p-5">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </GlassCard>

      {/* Fleet KPI Table Skeleton */}
      <GlassCard className="space-y-4 p-5">
        <Skeleton className="h-5 w-56" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </GlassCard>
    </div>
  );
}
