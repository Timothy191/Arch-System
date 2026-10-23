'use client';

import { cn } from '@repo/ui/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface AcknowledgeButtonProps {
  onAcknowledge: () => void;
  onUndo?: () => void;
  className?: string;
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
}

/**
 * A specialized button for acknowledging alarms/alerts with a toast undo gate.
 * Reduces accidental dismissals of critical system status notifications without blocking UI.
 */
export function AcknowledgeButton({
  onAcknowledge,
  onUndo,
  className,
  label = 'Acknowledge',
  confirmTitle = 'Alarm Acknowledged',
  confirmDescription = 'This action will mark the status as reviewed.',
}: AcknowledgeButtonProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic UI updates
    setAcknowledged(true);
    onAcknowledge();

    toast.success(confirmTitle, {
      description: confirmDescription,
      action: onUndo
        ? {
            label: 'Undo',
            onClick: () => {
              setAcknowledged(false);
              onUndo();
            },
          }
        : undefined,
    });
  };

  if (acknowledged) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1 text-[var(--text-muted)] text-xs transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]',
        className
      )}
    >
      {label}
    </button>
  );
}
