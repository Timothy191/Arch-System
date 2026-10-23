'use client';

/**
 * SkipLinks provides keyboard navigation shortcuts for accessibility.
 * Allows keyboard users to skip repetitive navigation and go directly to main content.
 *
 * WCAG 2.1 Success Criteria:
 * - 2.4.1 Bypass Blocks (Level A)
 * - 2.4.3 Focus Order (Level A)
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-0 left-0 z-skip-link rounded-br-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="fixed top-0 left-0 z-skip-link ml-48 rounded-br-lg bg-[var(--accent-blue)] px-4 py-2 font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2"
      >
        Skip to navigation
      </a>
    </div>
  );
}
