import { useState, useEffect } from "react";

/**
 * Custom hook to detect if focus mode is active by watching the "focus-mode" class
 * on the document body. Useful for components in the shared UI package that cannot
 * directly import the Zustand store from the portal application.
 */
export function useFocusMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check initial state
    setEnabled(document.body.classList.contains("focus-mode"));

    const observer = new MutationObserver(() => {
      setEnabled(document.body.classList.contains("focus-mode"));
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return enabled;
}
