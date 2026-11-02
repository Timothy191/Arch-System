import { GlassSkeleton } from '@repo/ui/components/ui/glass-skeleton';

export default function HourlyLoadsLoading() {
  return (
    <div className="space-y-6">
      <GlassSkeleton showHeader rows={1} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
      </div>
      <GlassSkeleton className="h-96" rows={6} />
    </div>
  );
}
