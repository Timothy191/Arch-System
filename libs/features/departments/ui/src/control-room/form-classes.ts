import { cn } from '@repo/ui/lib/utils';

/** Shared input and select field styling for Control Room forms. */
export const CONTROL_ROOM_FIELD_CLASS = cn(
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5',
  'text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)]',
  'focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20'
);
