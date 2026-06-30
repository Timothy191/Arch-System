"use client";

import * as React from "react";
import { useState } from "react";
import { ActionConfirmDialog } from "./ui/action-confirm-dialog";
import { cn } from "@repo/ui/lib/utils";

interface AcknowledgeButtonProps {
  onAcknowledge: () => void;
  className?: string;
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
}

/**
 * A specialized button for acknowledging alarms/alerts with a confirmation gate.
 * Reduces accidental dismissals of critical system status notifications.
 */
export function AcknowledgeButton({
  onAcknowledge,
  className,
  label = "Acknowledge",
  confirmTitle = "Confirm Acknowledgment",
  confirmDescription = "Are you sure you want to acknowledge this alert? This action will mark the status as reviewed.",
}: AcknowledgeButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsDialogOpen(true);
        }}
        className={cn(
          "px-3 py-1 rounded-lg bg-[var(--bg-primary)] text-[var(--text-muted)] text-xs hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-default)]",
          className,
        )}
      >
        {label}
      </button>

      <ActionConfirmDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={onAcknowledge}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="Acknowledge"
      />
    </>
  );
}
