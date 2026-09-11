"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { PollingOptions } from "./types";

/**
 * Hook for managing periodic polling with pause, resume, and immediate execution flags.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number | null,
  options: PollingOptions = {}
): { isPolling: boolean; pause: () => void; resume: () => void } {
  const { immediate = false, autoStart = true } = options;

  const [isPolling, setIsPolling] = useState<boolean>(autoStart && intervalMs !== null);
  const callbackRef = useRef(callback);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const pause = useCallback(() => {
    setIsPolling(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (intervalMs !== null) {
      setIsPolling(true);
    }
  }, [intervalMs]);

  useEffect(() => {
    if (!isPolling || intervalMs === null) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (immediate) {
      callbackRef.current();
    }

    timerRef.current = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPolling, intervalMs, immediate]);

  return { isPolling, pause, resume };
}
