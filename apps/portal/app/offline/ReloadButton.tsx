'use client';

export default function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-6 py-2 font-medium text-[var(--text-heading)] transition-colors hover:bg-[var(--bg-hover)]"
    >
      Try Again
    </button>
  );
}
