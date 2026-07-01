"use client";

export default function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-heading)] rounded-lg font-medium transition-colors border border-[var(--border-subtle)]"
    >
      Try Again
    </button>
  );
}
