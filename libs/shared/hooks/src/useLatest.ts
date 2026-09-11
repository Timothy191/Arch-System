"use client";

import { useRef, useEffect, type RefObject } from "react";

/**
 * Hook that returns a mutable ref holding the latest value across renders.
 * Useful for accessing fresh state inside async callbacks or long-lived effects without adding to dependency arrays.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef<T>(value);
  ref.current = value;
  return ref;
}

/**
 * Hook that tracks the previous state or prop value from the prior render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
