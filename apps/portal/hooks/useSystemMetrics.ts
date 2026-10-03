'use client';

import { getThreeShift } from '@repo/utils';
import { useEffect, useState } from 'react';

interface SystemMetrics {
  websocketLatency: number; // mock latency in ms
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
  websocketLatency: 15,
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
      websocketLatency: 15,
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
      const newShift = getThreeShift(now);

      setMetrics((prev) => {
        // PERFORMANCE OPTIMIZATION:
        // getThreeShift returns a new object on every call.
        // Compare shift identifier (prev.currentShift.shift === newShift.shift) to avoid creating
        // new object references or triggering state updates when the shift has not changed.
        const shiftUnchanged =
          prev.currentShift.shift === newShift.shift &&
          prev.currentShift.label === newShift.label &&
          prev.currentShift.start === newShift.start &&
          prev.currentShift.end === newShift.end;

        if (prev.serverTimeSAST === serverTimeSAST && shiftUnchanged) {
          return prev;
        }

        return {
          ...prev,
          serverTimeSAST,
          currentShift: shiftUnchanged ? prev.currentShift : newShift,
        };
      });
    }, 1000);

    // Simulate websocket latency update every 3 seconds
    const updateLatency = () => {
      const base = 12;
      const jitter = Math.floor(Math.random() * 15);
      const spike = Math.random() > 0.95 ? Math.floor(Math.random() * 45) : 0; // 5% chance of spike
      const newLatency = base + jitter + spike;

      setMetrics((prev) => {
        if (prev.websocketLatency === newLatency) {
          return prev;
        }
        return {
          ...prev,
          websocketLatency: newLatency,
        };
      });
    };

    updateLatency();
    const latencyInterval = setInterval(updateLatency, 3000);

    return () => {
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
