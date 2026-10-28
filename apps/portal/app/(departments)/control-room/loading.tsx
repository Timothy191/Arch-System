import { GlassSkeleton } from '@repo/ui/components/ui/glass-skeleton';

export default function ControlRoomLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading control room operations">
      <GlassSkeleton showHeader rows={2} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
      </div>
      <GlassSkeleton className="h-96" rows={1} />
    </div>
  );
}
