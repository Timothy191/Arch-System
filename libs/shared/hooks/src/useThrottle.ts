"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ThrottleOptions } from "./types";

/**
 * Hook that returns a throttled version of the provided value.
 * Updates at most once per specified delay interval.
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecutedRef = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastExecutedRef.current;

    if (elapsed >= delay) {
      lastExecutedRef.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastExecutedRef.current = Date.now();
        setThrottledValue(value);
      }, delay - elapsed);
      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  return throttledValue;
}

/**
 * Hook that wraps a function with a throttled controller.
 * Ensures the function is called at most once per delay duration.
 */
export function useThrottleFn<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options: ThrottleOptions = {}
): { run: (...args: Parameters<T>) => void; cancel: () => void } {
  const { leading = true, trailing = true } = options;

  const fnRef = useRef(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExecutedRef = useRef<number>(0);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastArgsRef.current = null;
  }, []);

  const run = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      lastArgsRef.current = args;

      if (!lastExecutedRef.current && !leading) {
        lastExecutedRef.current = now;
      }

      const elapsed = now - lastExecutedRef.current;

      if (elapsed >= delay) {
        if (leading) {
          lastExecutedRef.current = now;
          fnRef.current(...args);
        }
      } else if (!timerRef.current && trailing) {
        timerRef.current = setTimeout(() => {
          lastExecutedRef.current = leading ? Date.now() : 0;
          timerRef.current = null;
          if (lastArgsRef.current) {
            fnRef.current(...lastArgsRef.current);
          }
        }, delay - elapsed);
      }
    },
    [delay, leading, trailing]
  );

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { run, cancel };
}
