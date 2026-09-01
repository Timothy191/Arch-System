"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Hook that debounces a value.
 *
 * Use cases:
 * - Search inputs (avoid API calls on every keystroke)
 * - Window resize handlers
 * - Any frequent updates that need throttling
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that returns a debounced callback function.
 *
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced callback
 */
export function useDebouncedCallback<T extends (..._args: any[]) => any>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = (..._args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(..._args);
    }, delay);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
}
