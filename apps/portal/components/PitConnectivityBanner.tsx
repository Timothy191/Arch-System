'use client';

import { usePitConnectivity } from '@repo/shared/hooks';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { memo } from 'react';

export interface PitConnectivityBannerProps {
  /** Optional custom ping URL */
  pingUrl?: string;
  /** Optional container class name */
  className?: string;
}

/**
 * PitConnectivityBanner
 *
 * Real-time network state banner for open-cast pit mining operators.
 * Detects packet loss / degraded "lie-fi" connections and displays status badges.
 */
export const PitConnectivityBanner = memo(function PitConnectivityBanner({
  pingUrl = '/api/health',
  className = '',
}: PitConnectivityBannerProps) {
  const { status, latencyMs, checkConnectivity } = usePitConnectivity({ pingUrl });

  if (status === 'online') {
    return null;
  }

  const isDegraded = status === 'degraded';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex w-full items-center justify-between border-b px-4 py-2.5 font-medium text-xs transition-all duration-200 ${
        isDegraded
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-900'
          : 'border-red-500/20 bg-red-500/10 text-red-900'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {isDegraded ? (
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-amber-600" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-red-600" />
        )}
        <span>
          {isDegraded
            ? `Degraded Network Detected${latencyMs ? ` (${latencyMs}ms)` : ''} — Local draft buffering active`
            : 'Offline Mode Active — Inputs are safely preserved in local draft buffer'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => checkConnectivity()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded border border-current bg-background/50 px-2.5 py-1 text-xs transition-colors hover:bg-background/80"
      >
        <RefreshCw className="h-3 w-3" />
        <span>Check Link</span>
      </button>
    </div>
  );
});
