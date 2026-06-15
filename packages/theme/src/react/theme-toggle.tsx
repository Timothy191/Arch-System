"use client";

import { Sun } from "lucide-react";

/**
 * ThemeToggle — Light mode indicator (non-interactive).
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      className={`glass-button h-9 w-9 rounded-full flex items-center justify-center ${className ?? ""}`}
      aria-label="Light mode"
    >
      <Sun className="h-4 w-4 text-[var(--text-secondary)]" />
    </button>
  );
}
