"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Hook to reactively evaluate media query strings using useSyncExternalStore.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const matchMedia = window.matchMedia(query);
      matchMedia.addEventListener("change", onChange);
      return () => matchMedia.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
