'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PitConnectivityStatus = 'online' | 'degraded' | 'offline';

export interface UsePitConnectivityOptions {
  /** Endpoint URL to ping for liveness check (default: '/api/health/live') */
  pingUrl?: string;
  /** Interval in ms between heartbeat pings (default: 15000ms) */
  pingIntervalMs?: number;
  /** Latency threshold in ms to classify connection as degraded (default: 1200ms) */
  degradedThresholdMs?: number;
  /** Request timeout in ms before marking attempt as failed (default: 4000ms) */
  timeoutMs?: number;
  /** Optional callback fired when status changes */
  onStatusChange?: (status: PitConnectivityStatus) => void;
}

/**
 * Cheap liveness probe. `/api/health` is a dependency check that issues a
 * Supabase query and a Redis PING on every call, so it must never be used as a
 * heartbeat: at 15s per mounted hook it becomes the single largest source of
 * client-driven server load. `/api/health/live` answers from memory.
 */
const DEFAULT_PING_URL = '/api/health/live';
const DEFAULT_PING_INTERVAL_MS = 15_000;
const DEFAULT_DEGRADED_THRESHOLD_MS = 1_200;
const DEFAULT_TIMEOUT_MS = 4_000;
/** Random ± spread applied to every scheduled probe so tabs do not sync up. */
const JITTER_RATIO = 0.2;
/** Consecutive failures are retried with exponential backoff, capped here. */
const MAX_BACKOFF_STEPS = 2;
const MAX_BACKOFF_MULTIPLIER = 4;
const MIN_PING_INTERVAL_MS = 1_000;

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * usePitConnectivity
 *
 * Industrial mining connectivity sensor combining browser event listeners
 * with lightweight jittered heartbeat probes to detect "lie-fi" and packet loss
 * in open-pit environments.
 *
 * The heartbeat is suspended while the tab is hidden and backs off while the
 * link is down, so a control room full of backgrounded tabs issues no probes.
 */
export function usePitConnectivity(options: UsePitConnectivityOptions = {}) {
  const {
    pingUrl = DEFAULT_PING_URL,
    pingIntervalMs = DEFAULT_PING_INTERVAL_MS,
    degradedThresholdMs = DEFAULT_DEGRADED_THRESHOLD_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<PitConnectivityStatus>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'offline';
    }
    return 'online';
  });

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => new Date());
  const consecutiveFailuresRef = useRef(0);

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: PitConnectivityStatus) => {
    setStatus((prev) => {
      if (prev !== newStatus) {
        onStatusChangeRef.current?.(newStatus);
        if (newStatus !== 'offline') {
          setLastOnlineAt(new Date());
        }
      }
      return newStatus;
    });
  }, []);

  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateStatus('offline');
      setLatencyMs(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = performance.now();

    try {
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      consecutiveFailuresRef.current = 0;

      const duration = Math.round(performance.now() - startTime);
      setLatencyMs(duration);

      if (response.ok) {
        updateStatus(duration > degradedThresholdMs ? 'degraded' : 'online');
      } else {
        updateStatus('degraded');
      }
    } catch {
      clearTimeout(timeoutId);
      consecutiveFailuresRef.current += 1;
      updateStatus('offline');
      setLatencyMs(null);
    }
  }, [pingUrl, degradedThresholdMs, timeoutMs, updateStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function scheduleNext() {
      clearTimer();
      if (isDisposed || isDocumentHidden()) return;

      const backoffSteps = Math.min(consecutiveFailuresRef.current, MAX_BACKOFF_STEPS);
      const baseDelayMs = Math.min(
        pingIntervalMs * 2 ** backoffSteps,
        pingIntervalMs * MAX_BACKOFF_MULTIPLIER
      );
      const jitterMs = (Math.random() - 0.5) * JITTER_RATIO * baseDelayMs;
      const delayMs = Math.max(Math.round(baseDelayMs + jitterMs), MIN_PING_INTERVAL_MS);

      timer = setTimeout(() => {
        void runProbe();
      }, delayMs);
    }

    async function runProbe() {
      if (isDisposed) return;
      if (!isDocumentHidden()) await checkConnectivity();
      scheduleNext();
    }

    const handleOnline = () => {
      consecutiveFailuresRef.current = 0;
      void runProbe();
    };

    const handleOffline = () => {
      updateStatus('offline');
      setLatencyMs(null);
    };

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        clearTimer();
        return;
      }
      void runProbe();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void runProbe();

    return () => {
      isDisposed = true;
      clearTimer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkConnectivity, pingIntervalMs, updateStatus]);

  return {
    status,
    isOnline: status !== 'offline',
    isDegraded: status === 'degraded',
    latencyMs,
    lastOnlineAt,
    checkConnectivity,
  };
}
