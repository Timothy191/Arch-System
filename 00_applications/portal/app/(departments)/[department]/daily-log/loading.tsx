import { GlassSkeleton } from "@repo/ui/components/ui/glass-skeleton";

export default function DailyLogLoading() {
  return (
    <div className="space-y-6">
      <GlassSkeleton showHeader rows={2} />
      <GlassSkeleton className="h-12" rows={1} />
      <GlassSkeleton className="h-96" rows={1} />
    </div>
  );
}
