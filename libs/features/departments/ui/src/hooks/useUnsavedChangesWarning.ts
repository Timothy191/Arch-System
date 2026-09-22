"use client";

import { useEffect } from "react";

/**
 * A hook to block navigation and show a confirmation prompt if there are unsaved changes.
 * Intercepts tab closures, same-origin link clicks, and browser back/forward buttons.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    // 1. Handle tab close, refresh, and external links (hard navigation)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Most modern browsers require returnValue to be set to a string
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // 2. Handle internal Next.js soft navigation link clicks
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        const href = anchor.getAttribute("href");

        // Only block same-origin, valid navigation paths (exclude external links, mailto, tel, anchor hashes, and javascript void)
        if (
          href &&
          !href.startsWith("mailto:") &&
          !href.startsWith("tel:") &&
          !href.startsWith("#") &&
          !href.startsWith("javascript:") &&
          (href.startsWith("/") || href.startsWith(window.location.origin))
        ) {
          const confirmLeave = window.confirm(
            "You have unsaved changes. Are you sure you want to leave?",
          );
          if (!confirmLeave) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    // Use capture phase (true) to intercept the event before Next.js's router click handler captures it
    document.addEventListener("click", handleAnchorClick, true);

    // 3. Handle browser back/forward buttons (popstate)
    const handlePopState = () => {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?",
      );
      if (!confirmLeave) {
        // Push state again to restore the current URL
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);
}
