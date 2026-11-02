'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThrottledDebounceOptions } from './types';

export const DEFAULT_THROTTLE_MS = 250;
export const DEFAULT_DEBOUNCE_MS = 300;

interface NormalizedThrottledDebounceConfig {
  throttleMs: number;
  debounceMs: number;
  isLeading: boolean;
  isTrailing: boolean;
}

function normalizeThrottledDebounceOptions(
  options: ThrottledDebounceOptions | number = {}
): NormalizedThrottledDebounceConfig {
  if (typeof options === 'number') {
    return {
      throttleMs: options,
      debounceMs: options,
      isLeading: false,
      isTrailing: true,
    };
  }

  return {
    throttleMs: options.throttleMs ?? DEFAULT_THROTTLE_MS,
    debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    isLeading: options.leading ?? false,
    isTrailing: options.trailing ?? true,
  };
}

/**
 * Combines periodic throttling (at most once per `throttleMs` during continuous changes)
 * with trailing debounce (guarantees the final settled `inputValue` is emitted after
 * `debounceMs` of inactivity).
 */
export function useThrottledDebounce<T>(
  inputValue: T,
  options: ThrottledDebounceOptions | number = {}
): T {
  const { throttleMs, debounceMs, isLeading, isTrailing } =
    normalizeThrottledDebounceOptions(options);

  const [settledValue, setSettledValue] = useState<T>(inputValue);
  const latestInputRef = useRef<T>(inputValue);
  const lastEmittedRef = useRef<T>(inputValue);
  const lastEmittedAtMsRef = useRef<number>(Date.now());
  const pendingCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const throttleTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    latestInputRef.current = inputValue;

    if (!isMountedRef.current) {
      isMountedRef.current = true;
      lastEmittedRef.current = inputValue;
      lastEmittedAtMsRef.current = Date.now();
      return;
    }

    const isBurstStarting = !debounceTimerRef.current && !throttleTimerRef.current;
    if (isBurstStarting && Object.is(inputValue, lastEmittedRef.current)) {
      return;
    }

    const commitLatestInput = (nextInput: T) => {
      lastEmittedAtMsRef.current = Date.now();
      lastEmittedRef.current = nextInput;
      pendingCountRef.current = 0;
      setSettledValue((previousSettled) =>
        Object.is(previousSettled, nextInput) ? previousSettled : nextInput
      );
    };

    const nowMs = Date.now();
    pendingCountRef.current += 1;

    if (isBurstStarting) {
      if (isLeading) {
        commitLatestInput(inputValue);
      } else {
        lastEmittedAtMsRef.current = nowMs;
      }
    } else {
      const elapsedMs = nowMs - lastEmittedAtMsRef.current;

      if (elapsedMs >= throttleMs) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = undefined;
        commitLatestInput(latestInputRef.current);
      } else if (pendingCountRef.current > 1 && !throttleTimerRef.current) {
        const remainingThrottleMs = throttleMs - elapsedMs;
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = undefined;
          commitLatestInput(latestInputRef.current);
        }, remainingThrottleMs);
      }
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = undefined;
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = undefined;
      if (isTrailing && !Object.is(lastEmittedRef.current, latestInputRef.current)) {
        commitLatestInput(latestInputRef.current);
      } else {
        pendingCountRef.current = 0;
      }
    }, debounceMs);
  }, [inputValue, throttleMs, debounceMs, isLeading, isTrailing]);

  useEffect(() => {
    return () => {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = undefined;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    };
  }, []);

  return settledValue;
}

/**
 * Wraps a callback with combined throttle + trailing debounce execution,
 * exposing `run`, `cancel`, and `flush` controllers.
 */
export function useThrottledDebounceFn<T extends (...args: never[]) => unknown>(
  callbackFn: T,
  options: ThrottledDebounceOptions | number = {}
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
} {
  const { throttleMs, debounceMs, isLeading, isTrailing } =
    normalizeThrottledDebounceOptions(options);

  const callbackRef = useRef<T>(callbackFn);
  const throttleTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const lastInvokedAtMsRef = useRef<number>(0);
  const pendingCountRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callbackFn;
  }, [callbackFn]);

  const cancel = useCallback(() => {
    clearTimeout(throttleTimerRef.current);
    throttleTimerRef.current = undefined;
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;
    lastArgsRef.current = null;
    pendingCountRef.current = 0;
  }, []);

  const invokePending = useCallback(() => {
    if (!lastArgsRef.current) return;
    const pendingArgs = lastArgsRef.current;
    lastArgsRef.current = null;
    pendingCountRef.current = 0;
    lastInvokedAtMsRef.current = Date.now();
    callbackRef.current(...pendingArgs);
  }, []);

  const flush = useCallback(() => {
    if (!lastArgsRef.current) {
      cancel();
      return;
    }
    const pendingArgs = lastArgsRef.current;
    cancel();
    lastInvokedAtMsRef.current = Date.now();
    callbackRef.current(...pendingArgs);
  }, [cancel]);

  const run = useCallback(
    (...args: Parameters<T>) => {
      const nowMs = Date.now();
      const isBurstStarting = !debounceTimerRef.current && !throttleTimerRef.current;

      lastArgsRef.current = args;
      pendingCountRef.current += 1;

      if (isBurstStarting) {
        if (isLeading) {
          invokePending();
        } else {
          lastInvokedAtMsRef.current = nowMs;
        }
      } else {
        const elapsedMs = nowMs - lastInvokedAtMsRef.current;

        if (elapsedMs >= throttleMs) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = undefined;
          invokePending();
        } else if (pendingCountRef.current > 1 && !throttleTimerRef.current) {
          const remainingThrottleMs = throttleMs - elapsedMs;
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = undefined;
            invokePending();
          }, remainingThrottleMs);
        }
      }

      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = undefined;
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = undefined;
        if (isTrailing && lastArgsRef.current) {
          invokePending();
        } else {
          lastArgsRef.current = null;
          pendingCountRef.current = 0;
        }
      }, debounceMs);
    },
    [throttleMs, debounceMs, isLeading, isTrailing, invokePending]
  );

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { run, cancel, flush };
}
