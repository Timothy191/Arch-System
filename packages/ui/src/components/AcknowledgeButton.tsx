"use client";

import { cn } from "@repo/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

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
  label = "Acknowledge",
  confirmTitle = "Alarm Acknowledged",
  confirmDescription = "This action will mark the status as reviewed.",
}: AcknowledgeButtonProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic UI updates
    setAcknowledged(true);
    onAcknowledge();
    
    toast.success(confirmTitle, {
      description: confirmDescription,
      action: onUndo ? {
        label: "Undo",
        onClick: () => {
          setAcknowledged(false);
          onUndo();
        }
      } : undefined,
    });
  };

  if (acknowledged) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "px-3 py-1 rounded-lg bg-[var(--bg-primary)] text-[var(--text-muted)] text-xs hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-default)]",
        className,
      )}
    >
      {label}
    </button>
  );
}
