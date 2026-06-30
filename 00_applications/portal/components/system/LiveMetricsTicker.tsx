"use client";

import React from "react";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { cn } from "@repo/ui/lib/utils";

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
        "flex items-center gap-2 font-mono text-[10px] tracking-wider text-black/45 select-none",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <span
          data-testid="pulsing-indicator"
          className={cn(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            online ? "bg-emerald-500" : "bg-rose-500",
          )}
        />
        <span className="font-semibold">{online ? "SYS_OK" : "SYS_OFF"}</span>
      </div>

      <span className="opacity-40">|</span>

      <span className="tabular-nums">SAST: {serverTimeSAST}</span>

      <span className="opacity-40">|</span>

      <span className="tabular-nums">RTT: {websocketLatency}ms</span>

      <span className="opacity-40">|</span>

      <span>
        {currentShift.label} ({currentShift.start}-{currentShift.end})
      </span>
    </div>
  );
}
