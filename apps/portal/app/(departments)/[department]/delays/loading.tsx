import { GlassSkeleton } from '@repo/ui/components/ui/glass-skeleton';

export default function DelaysLoading() {
  return (
    <div className="space-y-6">
      <GlassSkeleton showHeader rows={2} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
        <GlassSkeleton rows={2} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <GlassSkeleton className="h-80" rows={5} />
        </div>
        <div className="xl:col-span-8">
          <GlassSkeleton className="h-80" rows={5} />
        </div>
      </div>
    </div>
  );
}
