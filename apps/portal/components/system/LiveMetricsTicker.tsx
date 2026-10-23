'use client';

import { cn } from '@repo/ui/lib/utils';
import { useSystemMetrics } from '@/hooks/useSystemMetrics';

interface LiveMetricsTickerProps {
  className?: string;
}

/**
 * LiveMetricsTicker
 *
 * Reusable ticker component styled with monospace font, small text sizing,
 * low opacity, and a pulsing status dot showing system connection health.
 */
export function LiveMetricsTicker({ className }: LiveMetricsTickerProps) {
  const { websocketLatency, serverTimeSAST, currentShift, online } = useSystemMetrics();

  return (
    <div
      data-testid="live-metrics-ticker"
      className={cn(
        'flex select-none items-center gap-2 font-mono text-[10px] text-black/45 tracking-wider',
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span
          data-testid="pulsing-indicator"
          className={cn(
            'h-1.5 w-1.5 animate-pulse rounded-full',
            online ? 'bg-emerald-500' : 'bg-rose-500'
          )}
        />
        <span className="font-semibold">{online ? 'SYS_OK' : 'SYS_OFF'}</span>
      </div>

      <span className="opacity-40">|</span>

      <span className="tabular-nums" suppressHydrationWarning>
        SAST: {serverTimeSAST}
      </span>

      <span className="opacity-40">|</span>

      <span className="tabular-nums">RTT: {websocketLatency}ms</span>

      <span className="opacity-40">|</span>

      <span>
        {currentShift.label} ({currentShift.start}-{currentShift.end})
      </span>
    </div>
  );
}
