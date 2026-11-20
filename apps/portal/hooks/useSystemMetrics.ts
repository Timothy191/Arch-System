'use client';

import { getThreeShift } from '@repo/utils/client';
import { useEffect, useState } from 'react';

interface SystemMetrics {
  websocketLatency: number; // measured HTTP/API round-trip latency in ms (0 when unmeasured)
  serverTimeSAST: string; // SAST formatted time string HH:MM:SS
  currentShift: {
    shift: 'A' | 'B' | 'C';
    label: string;
    start: string;
    end: string;
  };
  online: boolean;
}

const INITIAL_FALLBACK: SystemMetrics = {
  websocketLatency: 0,
  serverTimeSAST: '00:00:00',
  currentShift: { shift: 'A', label: 'Morning Shift', start: '06:00', end: '14:00' },
  online: true,
};

export function useSystemMetrics(): SystemMetrics {
  const [metrics, setMetrics] = useState<SystemMetrics>(INITIAL_FALLBACK);

  useEffect(() => {
    // Set initial real time right after mount
    const now = new Date();
    setMetrics({
      websocketLatency: 0,
      serverTimeSAST: now.toLocaleTimeString('en-US', {
        timeZone: 'Africa/Johannesburg',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      currentShift: getThreeShift(now),
      online: typeof window !== 'undefined' ? window.navigator.onLine : true,
    });

    // Network status change listeners
    const handleOnline = () =>
      setMetrics((prev) => (prev.online ? prev : { ...prev, online: true }));
    const handleOffline = () =>
      setMetrics((prev) => (!prev.online ? prev : { ...prev, online: false }));

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Tick clock and update shift every second
    const clockInterval = setInterval(() => {
      const now = new Date();
      const serverTimeSAST = now.toLocaleTimeString('en-US', {
        timeZone: 'Africa/Johannesburg',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const currentShift = getThreeShift(now);

      setMetrics((prev) => {
        if (prev.serverTimeSAST === serverTimeSAST && prev.currentShift === currentShift) {
          return prev;
        }
        return {
          ...prev,
          serverTimeSAST,
          currentShift,
        };
      });
    }, 1000);

    let isCancelled = false;

    // Measure real server round-trip latency every 15 seconds
    const measureLatency = async () => {
      if (typeof fetch !== 'function') return;
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        await fetch('/api/health/live', { method: 'GET', cache: 'no-store' });
        if (isCancelled) return;
        const elapsed =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        const measuredLatency = Math.max(1, Math.round(elapsed));
        setMetrics((prev) =>
          prev.websocketLatency === measuredLatency
            ? prev
            : { ...prev, websocketLatency: measuredLatency }
        );
      } catch {
        // Leave previous latency unchanged if probe fails
      }
    };

    void measureLatency();
    const latencyInterval = setInterval(() => {
      void measureLatency();
    }, 15_000);

    return () => {
      isCancelled = true;
      clearInterval(clockInterval);
      clearInterval(latencyInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return metrics;
}
