"use client";

import React from "react";

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
        className="fixed top-0 left-0 z-[9999] px-4 py-2 bg-[var(--accent-blue)] text-white font-medium rounded-br-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="fixed top-0 left-0 z-[9999] px-4 py-2 bg-[var(--accent-blue)] text-white font-medium rounded-br-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2 ml-48"
      >
        Skip to navigation
      </a>
    </div>
  );
}
