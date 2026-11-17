import { Zap } from 'lucide-react';

export default function OverviewLoading() {
  return (
    <div className="flex flex-col items-center gap-4 p-8" role="status" aria-live="polite">
      <Zap className="h-12 w-12 animate-pulse text-accent-gold" aria-hidden="true" />
      <p className="text-sm text-text-secondary">Loading system overview data...</p>
    </div>
  );
}
