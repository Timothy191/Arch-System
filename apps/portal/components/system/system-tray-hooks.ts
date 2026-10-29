'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
//  Types for APIs not in all TS lib definitions
/* ------------------------------------------------------------------ */
interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(
    _type: 'chargingchange' | 'levelchange' | 'chargingtimechange' | 'dischargingtimechange',
    _listener: EventListenerOrEventListenerObject
  ): void;
  removeEventListener(
    _type: 'chargingchange' | 'levelchange' | 'chargingtimechange' | 'dischargingtimechange',
    _listener: EventListenerOrEventListenerObject
  ): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

interface NetworkConnection extends EventTarget {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  downlink?: number;
  downlinkMax?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection;
  mozConnection?: NetworkConnection;
  webkitConnection?: NetworkConnection;
}

/* ------------------------------------------------------------------ */
//  Helpers
/* ------------------------------------------------------------------ */
export function formatTimeSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 'Calculating…';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ------------------------------------------------------------------ */
//  useNetworkStatus
/* ------------------------------------------------------------------ */
// AGENT-TRACE: Consolidated network status state into a single state object with equality check to prevent update depth recursion.
export function useNetworkStatus() {
  const [status, setStatus] = useState<{
    online: boolean;
    effectiveType?: NetworkConnection['effectiveType'];
    connType?: NetworkConnection['type'];
    downlink?: number;
    rtt?: number;
    supported: boolean;
  }>({
    online: true,
    supported: true,
  });

  useEffect(() => {
    const nav =
      typeof navigator !== 'undefined' ? (navigator as NavigatorWithConnection) : undefined;
    const connection = nav?.connection ?? nav?.mozConnection ?? nav?.webkitConnection;

    const sync = () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const isSupported = Boolean(connection);
      const nextEffectiveType = connection?.effectiveType;
      const nextConnType = connection?.type;
      const nextDownlink = connection?.downlink;
      const nextRtt = connection?.rtt;

      setStatus((prev) => {
        if (
          prev.online === isOnline &&
          prev.supported === isSupported &&
          prev.effectiveType === nextEffectiveType &&
          prev.connType === nextConnType &&
          prev.downlink === nextDownlink &&
          prev.rtt === nextRtt
        ) {
          return prev;
        }
        return {
          online: isOnline,
          supported: isSupported,
          effectiveType: nextEffectiveType,
          connType: nextConnType,
          downlink: nextDownlink,
          rtt: nextRtt,
        };
      });
    };

    sync();

    const handleOnline = () => sync();
    const handleOffline = () => sync();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (connection) {
      connection.addEventListener('change', sync);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', sync);
      }
    };
  }, []);

  return status;
}

/* ------------------------------------------------------------------ */
//  useBatteryStatus
/* ------------------------------------------------------------------ */
export function useBatteryStatus() {
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [chargingTime, setChargingTime] = useState<number>(Infinity);
  const [dischargingTime, setDischargingTime] = useState<number>(Infinity);
  const [supported, setSupported] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (!nav.getBattery) {
      setSupported(false);
      return;
    }

    let cancelled = false;

    nav.getBattery().then((b) => {
      if (cancelled) return;

      const sync = () => {
        setLevel(b.level);
        setCharging(b.charging);
        setChargingTime(b.chargingTime);
        setDischargingTime(b.dischargingTime);
      };
      sync();

      b.addEventListener('chargingchange', sync);
      b.addEventListener('levelchange', sync);
      b.addEventListener('chargingtimechange', sync);
      b.addEventListener('dischargingtimechange', sync);

      cleanupRef.current = () => {
        b.removeEventListener('chargingchange', sync);
        b.removeEventListener('levelchange', sync);
        b.removeEventListener('chargingtimechange', sync);
        b.removeEventListener('dischargingtimechange', sync);
      };
    });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return { level, charging, chargingTime, dischargingTime, supported };
}

/* ------------------------------------------------------------------ */
//  useAppVolume
/* ------------------------------------------------------------------ */
export function useAppVolume() {
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 75;
    const raw = window.localStorage.getItem('arch-app-volume');
    return raw ? Math.min(100, Math.max(0, Number(raw))) : 75;
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('arch-app-muted') === 'true';
  });

  const persist = useCallback((v: number, m: boolean) => {
    window.localStorage.setItem('arch-app-volume', String(v));
    window.localStorage.setItem('arch-app-muted', String(m));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      persist(volume, !m);
      return !m;
    });
  }, [volume, persist]);

  const adjust = useCallback(
    (v: number) => {
      const clamped = Math.min(100, Math.max(0, v));
      setVolume(clamped);
      const m = clamped === 0;
      setMuted(m);
      persist(clamped, m);
    },
    [persist]
  );

  return { volume, muted, toggleMute, adjust };
}

/* ------------------------------------------------------------------ */
//  useNotificationCount
/* ------------------------------------------------------------------ */
export function useNotificationCount() {
  const [count, setCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem('arch-tray-notifications');
    return raw ? Math.max(0, Number(raw)) : 0;
  });

  const clear = useCallback(() => {
    setCount(0);
    window.localStorage.setItem('arch-tray-notifications', '0');
  }, []);

  return { count, clear };
}

/* ------------------------------------------------------------------ */
//  useServerHealth
/* ------------------------------------------------------------------ */
export interface HealthState {
  status: 'healthy' | 'error' | 'degraded';
  db: 'ok' | 'degraded' | 'unavailable' | 'disabled';
  redis: 'ok' | 'degraded' | 'unavailable' | 'disabled';
  fuxa: 'ok' | 'degraded' | 'unavailable' | 'disabled';
  responseTime: number;
  timestamp: string;
  loading: boolean;
  lastFetched: number | null;
}

interface RawServiceHealth {
  status?: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  latencyMs?: number;
  error?: string;
}

interface RawHealthApiResponse {
  status?: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  latencyMs?: number;
  latency_ms?: number;
  timestamp?: string;
  last_check?: string;
  services?: {
    supabase?: RawServiceHealth | null;
    supabase_realtime?: RawServiceHealth | null;
    redis?: RawServiceHealth | null;
    fuxa?: RawServiceHealth | null;
  };
}

export function mapHealthResponseToState(json: RawHealthApiResponse): HealthState {
  const mapServiceStatus = (
    s: RawServiceHealth | null | undefined
  ): 'ok' | 'degraded' | 'unavailable' => {
    if (!s?.status) return 'unavailable';
    if (s.status === 'healthy') return 'ok';
    if (s.status === 'degraded') return 'degraded';
    return 'unavailable';
  };

  const statusMap = {
    healthy: 'healthy',
    degraded: 'degraded',
    unhealthy: 'error',
    down: 'error',
  } as const;

  const overallStatus = json.status
    ? (statusMap[json.status as keyof typeof statusMap] ?? 'error')
    : 'error';
  const rawLatency = json.latencyMs ?? json.latency_ms ?? 0;

  return {
    status: overallStatus,
    db: mapServiceStatus(json.services?.supabase ?? json.services?.supabase_realtime),
    redis: mapServiceStatus(json.services?.redis),
    // AGENT-TRACE: SCADA (FUXA) uses reverse-flow Redis tag ingest (/api/scada/tags);
    // prefer explicit services.fuxa and fall back to services.redis when rolling across deploys.
    fuxa: mapServiceStatus(json.services?.fuxa ?? json.services?.redis),
    responseTime: rawLatency > 0 ? rawLatency : overallStatus !== 'error' ? 1 : 0,
    timestamp: json.timestamp ?? json.last_check ?? '',
    loading: false,
    lastFetched: Date.now(),
  };
}

// AGENT-TRACE: Replaced manual useEffect+setInterval polling with React Query
// for automatic deduplication, stale-while-revalidate, visibility-aware refetch,
// and proper cleanup on unmount. Reduces redundant API calls across tab switches.
export function useServerHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ['server-health'],
    queryFn: async (): Promise<HealthState> => {
      // The route already ships `max-age=60, stale-while-revalidate=600`, which
      // matches this poll interval. `no-store` would force a function invocation
      // (Supabase query + Redis PING) per tab per minute instead.
      const res = await fetch('/api/health', {
        method: 'GET',
      });
      const json = (await res.json()) as RawHealthApiResponse;
      return mapHealthResponseToState(json);
    },
    // AGENT-TRACE: 60s interval + refetchOnWindowFocus avoids hammering the
    // health endpoint when the tray popover is closed or the tab is hidden.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  return (
    data ?? {
      status: 'healthy' as const,
      db: 'ok' as const,
      redis: 'ok' as const,
      fuxa: 'ok' as const,
      responseTime: 0,
      timestamp: '',
      loading: isLoading,
      lastFetched: null,
    }
  );
}
