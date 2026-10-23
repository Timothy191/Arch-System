'use client';

import { Sun } from 'lucide-react';

/**
 * ThemeToggle — Light mode indicator (non-interactive).
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      className={`glass-button flex h-9 w-9 items-center justify-center rounded-full ${className ?? ''}`}
      aria-label="Light mode"
    >
      <Sun className="h-4 w-4 text-[var(--text-secondary)]" />
    </button>
  );
}
