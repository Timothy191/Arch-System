"use client";

import { memo } from "react";
import { usePitConnectivity } from "@repo/shared/hooks";
import { AlertTriangle, WifiOff, RefreshCw } from "lucide-react";

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
  pingUrl = "/api/health",
  className = "",
}: PitConnectivityBannerProps) {
  const { status, latencyMs, checkConnectivity } = usePitConnectivity({ pingUrl });

  if (status === "online") {
    return null;
  }

  const isDegraded = status === "degraded";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium transition-all duration-200 border-b ${
        isDegraded
          ? "bg-amber-500/10 text-amber-900 border-amber-500/20"
          : "bg-red-500/10 text-red-900 border-red-500/20"
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {isDegraded ? (
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <span>
          {isDegraded
            ? `Degraded Network Detected${latencyMs ? ` (${latencyMs}ms)` : ""} — Local draft buffering active`
            : "Offline Mode Active — Inputs are safely preserved in local draft buffer"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => checkConnectivity()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-current bg-background/50 hover:bg-background/80 transition-colors shrink-0 text-xs"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Check Link</span>
      </button>
    </div>
  );
});
