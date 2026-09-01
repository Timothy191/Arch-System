"use client";

import React, { useEffect, useRef, useCallback } from "react";

interface FocusManagerProps {
  children: React.ReactNode;
  enabled?: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

/**
 * FocusManager handles focus trapping for modals and dialogs.
 *
 * WCAG 2.1 Success Criteria:
 * - 2.4.3 Focus Order (Level A)
 * - 2.1.2 No Keyboard Trap (Level A)
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html
 */
export function FocusManager({
  children,
  enabled = true,
  onEscape,
  restoreFocus = true,
}: FocusManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when manager mounts
  useEffect(() => {
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [restoreFocus]);

  // Restore focus when manager unmounts
  useEffect(() => {
    return () => {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [restoreFocus]);

  // Handle keyboard events for focus trapping
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || !containerRef.current) return;

      // Handle Escape key
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === "Tab") {
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift + Tab: If on first element, move to last
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        }
        // Tab: If on last element, move to first
        else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [enabled, onEscape],
  );

  // Focus the first focusable element when enabled
  useEffect(() => {
    if (enabled && containerRef.current) {
      const firstFocusable = containerRef.current.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, [enabled]);

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} role="dialog" aria-modal="true" tabIndex={-1}>
      {children}
    </div>
  );
}
