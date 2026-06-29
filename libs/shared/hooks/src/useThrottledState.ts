import { useState, useRef, useEffect, useCallback } from "react";

/**
 * useThrottledState
 *
 * A hook that behaves like useState, but throttles state updates to at most once
 * per `delay` milliseconds. Intermediate updates are queued and processed together
 * at the next tick, ensuring functional state transitions (like appending to an array)
 * are not lost while significantly reducing React render and layout recalculation frequency.
 */
export function useThrottledState<T>(
  initialValue: T | (() => T),
  delay = 500,
): [T, (_value: T | ((_prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const queue = useRef<(T | ((_prev: T) => T))[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdated = useRef<number>(0);

  const processQueue = useCallback(() => {
    if (queue.current.length === 0) return;

    setState((prev) => {
      let current = prev;
      for (const update of queue.current) {
        if (typeof update === "function") {
          current = (update as (_p: T) => T)(current);
        } else {
          current = update;
        }
      }
      queue.current = [];
      return current;
    });

    lastUpdated.current = Date.now();
    timeoutRef.current = null;
  }, []);

  const setThrottledState = useCallback(
    (value: T | ((_prev: T) => T)) => {
      queue.current.push(value);

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdated.current;

      if (timeSinceLastUpdate >= delay) {
        processQueue();
      } else if (!timeoutRef.current) {
        const remaining = delay - timeSinceLastUpdate;
        timeoutRef.current = setTimeout(processQueue, remaining);
      }
    },
    [delay, processQueue],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setThrottledState];
}
