"use client";

import { useEffect, useCallback, useRef } from "react";

interface AutoSaveOptions<T> {
  key: string;
  onLoad?: (data: T) => void;
  debounceMs?: number;
}

/**
 * A hook to automatically save state to localStorage with debouncing.
 * Useful for preventing data loss in forms like shift closeout notes.
 */
export function useAutoSave<T>(data: T, { key, onLoad, debounceMs = 1000 }: AutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Load data on mount
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved && onLoad) {
      try {
        const parsed = JSON.parse(saved);
        onLoad(parsed);
      } catch (e) {
        console.error("Failed to parse auto-saved data", e);
      }
    }
    isFirstRender.current = false;
  }, [key, onLoad]);

  // Save data on change with debounce
  useEffect(() => {
    if (isFirstRender.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(data));
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, debounceMs]);

  const clear = useCallback(() => {
    localStorage.removeItem(key);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [key]);

  return { clear };
}
