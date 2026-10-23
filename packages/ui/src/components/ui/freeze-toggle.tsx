'use client';

import { cn } from '@repo/ui/lib/utils';
import { Pause, Play } from 'lucide-react';

interface FreezeToggleProps {
  isFrozen: boolean;
  onToggle: (frozen: boolean) => void;
  className?: string;
}

/**
 * A specialized toggle button for "freezing" live data updates.
 * Essential for industrial operators to inspect transient spikes or anomalies.
 */
export function FreezeToggle({ isFrozen, onToggle, className }: FreezeToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!isFrozen)}
      className={cn(
        'flex select-none items-center gap-2 rounded-lg border px-3 py-1.5 font-medium text-xs transition-all duration-200',
        isFrozen
          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-heading)]',
        className
      )}
      aria-pressed={isFrozen}
      aria-label={isFrozen ? 'Resume live updates' : 'Freeze live updates'}
    >
      {isFrozen ? (
        <>
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>FROZEN</span>
        </>
      ) : (
        <>
          <Pause className="h-3.5 w-3.5" />
          <span>LIVE</span>
        </>
      )}
    </button>
  );
}
