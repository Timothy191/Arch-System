"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface FreezeToggleProps {
  isFrozen: boolean;
  onToggle: (frozen: boolean) => void;
  className?: string;
}

/**
 * A specialized toggle button for "freezing" live data updates.
 * Essential for industrial operators to inspect transient spikes or anomalies.
 */
export function FreezeToggle({
  isFrozen,
  onToggle,
  className,
}: FreezeToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!isFrozen)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 text-xs font-medium select-none",
        isFrozen
          ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
          : "bg-[var(--bg-secondary)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:border-[var(--border-emphasis)]",
        className,
      )}
      aria-pressed={isFrozen}
      aria-label={isFrozen ? "Resume live updates" : "Freeze live updates"}
    >
      {isFrozen ? (
        <>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>FROZEN</span>
        </>
      ) : (
        <>
          <Pause className="w-3.5 h-3.5" />
          <span>LIVE</span>
        </>
      )}
    </button>
  );
}
