'use client';

import { Zap } from 'lucide-react';

export default function OverviewLoading() {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <Zap className="h-12 w-12 text-gray-400" />
      <p className="text-gray-500">Loading system overview data...</p>
    </div>
  );
}
