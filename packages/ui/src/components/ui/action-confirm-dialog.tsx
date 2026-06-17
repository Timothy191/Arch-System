"use client";

import * as React from "react";
import { AnimatedDialog } from "./animated-dialog";
import { Button } from "./button";

interface ActionConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

/**
 * A reusable confirmation dialog for critical or destructive actions.
 */
export function ActionConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ActionConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatedDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="flex justify-end gap-3 mt-6">
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-heading)]"
        >
          {cancelText}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={handleConfirm}
          className={
            variant === "default"
              ? "bg-accent-blue hover:bg-accent-blue/90 text-white border-none"
              : ""
          }
        >
          {confirmText}
        </Button>
      </div>
    </AnimatedDialog>
  );
}
