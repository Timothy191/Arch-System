import { GlassSkeleton } from "@repo/ui/components/ui/glass-skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-full max-w-md space-y-4 p-6">
        <GlassSkeleton showHeader rows={3} />
      </div>
    </div>
  );
}
