"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PitConnectivityStatus = "online" | "degraded" | "offline";

export interface UsePitConnectivityOptions {
  /** Endpoint URL to ping for liveness check (default: '/api/health') */
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
 * usePitConnectivity
 *
 * Industrial mining connectivity sensor combining browser event listeners
 * with lightweight jittered heartbeat probes to detect "lie-fi" and packet loss in open-pit environments.
 */
export function usePitConnectivity(options: UsePitConnectivityOptions = {}) {
  const {
    pingUrl = "/api/health",
    pingIntervalMs = 15000,
    degradedThresholdMs = 1200,
    timeoutMs = 4000,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<PitConnectivityStatus>(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "offline";
    }
    return "online";
  });

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => new Date());

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: PitConnectivityStatus) => {
    setStatus((prev) => {
      if (prev !== newStatus) {
        onStatusChangeRef.current?.(newStatus);
        if (newStatus !== "offline") {
          setLastOnlineAt(new Date());
        }
      }
      return newStatus;
    });
  }, []);

  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updateStatus("offline");
      setLatencyMs(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = performance.now();

    try {
      const response = await fetch(pingUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - startTime);
      setLatencyMs(duration);

      if (response.ok) {
        if (duration > degradedThresholdMs) {
          updateStatus("degraded");
        } else {
          updateStatus("online");
        }
      } else {
        updateStatus("degraded");
      }
    } catch {
      clearTimeout(timeoutId);
      updateStatus("offline");
      setLatencyMs(null);
    }
  }, [pingUrl, degradedThresholdMs, timeoutMs, updateStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      checkConnectivity();
    };

    const handleOffline = () => {
      updateStatus("offline");
      setLatencyMs(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    checkConnectivity();

    // Heartbeat ping interval with jitter (+/- 10%)
    const jitter = (Math.random() - 0.5) * 0.2 * pingIntervalMs;
    const intervalId = setInterval(checkConnectivity, pingIntervalMs + jitter);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(intervalId);
    };
  }, [checkConnectivity, pingIntervalMs, updateStatus]);

  return {
    status,
    isOnline: status !== "offline",
    isDegraded: status === "degraded",
    latencyMs,
    lastOnlineAt,
    checkConnectivity,
  };
}
