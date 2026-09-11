"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { DebounceOptions } from "./types";

/**
 * Hook that returns a debounced version of the provided value.
 * Useful for delaying search queries, auto-save inputs, or filter changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that wraps a function with a debounced execution controller.
 * Supports leading/trailing execution, maxWait, cancel(), and flush().
 */
export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options: DebounceOptions = {}
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
} {
  const { leading = false, trailing = true, maxWait } = options;

  const fnRef = useRef(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current && lastArgsRef.current) {
      fnRef.current(...lastArgsRef.current);
      cancel();
    }
  }, [cancel]);

  const run = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;
      const isFirst = !timerRef.current;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (leading && isFirst) {
        fnRef.current(...args);
      }

      timerRef.current = setTimeout(() => {
        if (trailing && lastArgsRef.current) {
          fnRef.current(...lastArgsRef.current);
        }
        cancel();
      }, delay);

      if (maxWait && !maxTimerRef.current) {
        maxTimerRef.current = setTimeout(() => {
          if (lastArgsRef.current) {
            fnRef.current(...lastArgsRef.current);
          }
          cancel();
        }, maxWait);
      }
    },
    [delay, leading, trailing, maxWait, cancel]
  );

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { run, cancel, flush };
}
