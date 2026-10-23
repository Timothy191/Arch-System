'use client';

import * as Popover from '@radix-ui/react-popover';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Bell,
  BellDot,
  CheckCircle2,
  Clock,
  CloudOff,
  Database,
  HardDrive,
  Home,
  MinusCircle,
  RefreshCw,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useFetchOfflineQueue } from '@/hooks/useFetchOfflineQueue';

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
interface HealthState {
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

export interface RawHealthApiResponse {
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
function useServerHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ['server-health'],
    queryFn: async (): Promise<HealthState> => {
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
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

/* ------------------------------------------------------------------ */
//  Row Components
/* ------------------------------------------------------------------ */

export function NetworkStatusRow({
  online,
  effectiveType,
  connType,
  downlink,
  rtt,
  supported,
}: ReturnType<typeof useNetworkStatus>) {
  const ConnQualityIcon = !online
    ? WifiOff
    : effectiveType === '4g' || effectiveType === '3g'
      ? SignalHigh
      : effectiveType === '2g'
        ? SignalMedium
        : effectiveType === 'slow-2g'
          ? SignalLow
          : Wifi;

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <ConnQualityIcon
        className={cn(
          'h-4 w-4 shrink-0',
          online ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[12px] text-[var(--text-heading)]">
            {online ? 'Connected' : 'Offline'}
          </span>
          {effectiveType && (
            <span className="text-[10px] text-[var(--text-muted)] uppercase">{effectiveType}</span>
          )}
        </div>
        {supported && online && (
          <div className="mt-0.5 flex items-center gap-2">
            {connType && (
              <span className="text-[10px] text-[var(--text-muted)] capitalize">{connType}</span>
            )}
            {typeof downlink === 'number' && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {downlink.toFixed(1)} Mbps
              </span>
            )}
            {typeof rtt === 'number' && (
              <span className="text-[10px] text-[var(--text-muted)]">{rtt} ms</span>
            )}
          </div>
        )}
        {!supported && (
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Network API unavailable</p>
        )}
      </div>
    </div>
  );
}

export function BatteryStatusRow({
  level,
  charging,
  chargingTime,
  dischargingTime,
  supported,
}: ReturnType<typeof useBatteryStatus>) {
  if (!supported || level === null) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <BatteryMedium className="h-4 w-4 text-[var(--text-secondary)]" />
        <span className="text-[12px] text-[var(--text-muted)]">Battery status unavailable</span>
      </div>
    );
  }

  const BatteryIcon = charging
    ? BatteryCharging
    : level <= 0.1
      ? BatteryWarning
      : level <= 0.3
        ? BatteryLow
        : level >= 0.8
          ? BatteryFull
          : BatteryMedium;

  const batteryColor = charging
    ? 'text-[var(--accent-green)]'
    : level < 0.5
      ? 'text-[var(--accent-red)]'
      : level < 0.7
        ? 'text-[var(--accent-amber)]'
        : 'text-[var(--accent-green)]';

  const barColor = charging
    ? 'bg-[var(--accent-green)]'
    : level < 0.5
      ? 'bg-[var(--accent-red)]'
      : level < 0.7
        ? 'bg-[var(--accent-amber)]'
        : 'bg-[var(--accent-green)]';

  return (
    <div className="space-y-1.5 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-2.5">
        <BatteryIcon className={cn('h-4 w-4 shrink-0', batteryColor)} />
        <div className="flex flex-1 items-center justify-between">
          <span className="font-medium text-[12px] text-[var(--text-heading)]">
            {Math.round(level * 100)}%
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {charging ? 'Charging' : 'On Battery'}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.round(level * 100)}%` }}
        />
      </div>
      {charging && Number.isFinite(chargingTime) && chargingTime > 0 && (
        <p className="text-[10px] text-[var(--accent-green)]">
          {formatTimeSeconds(chargingTime)} to full
        </p>
      )}
      {!charging && Number.isFinite(dischargingTime) && dischargingTime > 0 && (
        <p className="text-[10px] text-[var(--text-muted)]">
          {formatTimeSeconds(dischargingTime)} remaining
        </p>
      )}
    </div>
  );
}

export function VolumeControlRow({
  volume,
  muted,
  toggleMute,
  adjust,
}: ReturnType<typeof useAppVolume>) {
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const volumeColor =
    muted || volume === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--accent-blue)]';

  return (
    <div className="space-y-1.5 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="rounded-md p-0.5 transition-colors hover:bg-black/[0.06]"
        >
          <VolumeIcon className={cn('h-4 w-4', volumeColor)} />
        </button>
        <span className="min-w-[2rem] font-medium text-[12px] text-[var(--text-heading)]">
          {muted ? 'Muted' : `${volume}%`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={muted ? 0 : volume}
        onChange={(e) => adjust(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 w-full accent-[var(--accent-blue)]"
      />
    </div>
  );
}

export function NotificationRow({ count, clear }: ReturnType<typeof useNotificationCount>) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <div className="relative">
        {count > 0 ? (
          <BellDot className="h-4 w-4 text-[var(--text-secondary)]" />
        ) : (
          <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
        )}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--accent-red)] px-[3px] font-bold text-[9px] text-white leading-none">
            {count}
          </span>
        )}
      </div>
      <span className="flex-1 text-[12px] text-[var(--text-heading)]">
        {count > 0 ? `${count} notification${count === 1 ? '' : 's'}` : 'No notifications'}
      </span>
      {count > 0 && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear notifications"
          className="text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
//  ServerHealthRow
/* ------------------------------------------------------------------ */
function HealthSubRow({
  label,
  status,
  icon: Icon,
}: {
  label: string;
  status: 'ok' | 'degraded' | 'unavailable' | 'disabled';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const config = {
    ok: { color: 'text-[var(--accent-green)]', label: 'OK' },
    degraded: { color: 'text-[var(--accent-blue)]', label: 'Degraded' },
    unavailable: { color: 'text-[var(--accent-red)]', label: 'Unavailable' },
    disabled: { color: 'text-[var(--text-muted)]', label: 'Disabled' },
  };
  const c = config[status] ?? config.ok;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3 w-3 shrink-0', c.color)} />
      <span className="flex-1 text-[11px] text-[var(--text-secondary)]">{label}</span>
      <span className={cn('font-medium text-[10px]', c.color)}>{c.label}</span>
    </div>
  );
}

export function ServerHealthRow({
  status,
  db,
  redis,
  fuxa,
  responseTime,
  loading,
}: Omit<HealthState, 'timestamp' | 'lastFetched'>) {
  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-[var(--accent-green)]',
      label: 'Healthy',
    },
    degraded: {
      icon: MinusCircle,
      color: 'text-[var(--accent-blue)]',
      label: 'Degraded',
    },
    error: {
      icon: AlertCircle,
      color: 'text-[var(--accent-red)]',
      label: 'Error',
    },
  };

  const current = statusConfig[status] ?? statusConfig.healthy;

  return (
    <div className="space-y-1.5 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-2.5">
        <current.icon className={cn('h-4 w-4 shrink-0', current.color)} />
        <span className="flex-1 font-medium text-[12px] text-[var(--text-heading)]">
          Server Health
        </span>
        <span className={cn('font-medium text-[10px]', current.color)}>{current.label}</span>
      </div>

      <div className="space-y-1">
        <HealthSubRow label="Database" status={db} icon={Database} />
        <HealthSubRow label="Redis" status={redis} icon={HardDrive} />
        <HealthSubRow label="SCADA (FUXA)" status={fuxa} icon={Zap} />
      </div>

      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
        <Clock className="h-3 w-3" />
        <span className="text-[10px]">
          {loading ? 'Checking…' : responseTime > 0 ? `${responseTime}ms` : 'Unavailable'}
        </span>
      </div>
    </div>
  );
}

function OfflineQueueRow() {
  const { pendingCount, isOnline, isSyncing, flushQueue } = useFetchOfflineQueue();

  if (pendingCount === 0 && isOnline) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/10 px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <CloudOff className="h-4 w-4 shrink-0 text-accent-amber" />
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-[12px] text-[var(--text-heading)]">
            {pendingCount > 0
              ? `${pendingCount} Offline Action${pendingCount > 1 ? 's' : ''}`
              : 'Offline Mode'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {!isOnline ? 'Tablet disconnected' : 'Pending replay'}
          </span>
        </div>
      </div>
      {pendingCount > 0 && isOnline && (
        <button
          type="button"
          onClick={() => flushQueue()}
          disabled={isSyncing}
          className="flex items-center gap-1 rounded-button bg-accent-amber px-2 py-1 font-medium text-[10px] text-white transition-colors hover:bg-accent-amber-hover disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── SystemTrayPill ─────────────────────────── */

interface SystemNotificationItem {
  id: string;
  title: string;
  message: string;
  unread: boolean;
}

const DEFAULT_NOTIFICATIONS: SystemNotificationItem[] = [
  {
    id: 'clearance-unlinked',
    title: 'Employee Clearance Notice',
    message: 'No personnel record linked to your account.',
    unread: true,
  },
];

function TaskbarNotificationBell() {
  const [items, setItems] = useState<SystemNotificationItem[]>(DEFAULT_NOTIFICATIONS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('arch-system-notification-items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }

    const handleNotification = (event: Event) => {
      const custom = event as CustomEvent<SystemNotificationItem>;
      const detail = custom.detail;
      if (!detail?.id || !detail?.message) return;

      setItems((prev) => {
        const exists = prev.some((item) => item.id === detail.id);
        const next = exists
          ? prev.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
          : [detail, ...prev];
        try {
          window.localStorage.setItem('arch-system-notification-items', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    };

    window.addEventListener('arch-system-notification', handleNotification);
    return () => window.removeEventListener('arch-system-notification', handleNotification);
  }, []);

  const unreadCount = items.filter((i) => i.unread).length;

  const markAllRead = () => {
    setItems((prev) => {
      const next = prev.map((item) => ({ ...item, unread: false }));
      try {
        window.localStorage.setItem('arch-system-notification-items', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          data-testid="taskbar-notifications-bell"
          className={cn(
            'gold-steel-border gold-steel-border-slim relative flex h-7 w-7 items-center justify-center rounded-full',
            'border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md hover:bg-[var(--material-thin)]',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.97]'
          )}
        >
          <Bell className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          {unreadCount > 0 && (
            <span
              data-testid="notification-unread-dot"
              aria-label={`${unreadCount} unread notifications`}
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--accent-red)] ring-1 ring-white"
            />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-popover w-72 rounded-card border border-black/[0.08] bg-white/95 p-3 shadow-window backdrop-blur-2xl',
            'flex select-none flex-col gap-2 focus:outline-none'
          )}
        >
          <div className="flex items-center justify-between border-black/[0.06] border-b px-1 pb-1.5">
            <span className="font-semibold text-[var(--text-heading)] text-xs">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="font-medium text-[10px] text-[var(--accent-blue)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-[var(--text-muted)]">
              No notifications
            </p>
          ) : (
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-2.5 text-left transition-colors',
                    item.unread
                      ? 'border-accent-amber/25 bg-accent-amber/5'
                      : 'border-black/[0.05] bg-black/[0.02]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[11px] text-[var(--text-heading)]">
                      {item.title}
                    </span>
                    {item.unread && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-red)]" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const SystemTrayPillInner = function SystemTrayPillInner() {
  const [trayOpen, setTrayOpen] = useState(false);
  const network = useNetworkStatus();
  const battery = useBatteryStatus();
  const volume = useAppVolume();
  const notifications = useNotificationCount();
  const health = useServerHealth();
  const offlineQueue = useFetchOfflineQueue();

  const healthDotColor = health.loading
    ? 'bg-[var(--text-muted)]'
    : health.status === 'healthy'
      ? 'bg-[var(--accent-green)]'
      : health.status === 'degraded'
        ? 'bg-[var(--accent-blue)]'
        : 'bg-[var(--accent-red)]';

  const VolumeIcon =
    volume.muted || volume.volume === 0 ? VolumeX : volume.volume < 50 ? Volume1 : Volume2;
  const volumeColor =
    volume.muted || volume.volume === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--accent-blue)]';

  const ConnIcon = !network.online ? WifiOff : Wifi;
  const connColor = network.online ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';

  const BatteryIcon = battery.charging
    ? BatteryCharging
    : (battery.level ?? 1) <= 0.1
      ? BatteryWarning
      : (battery.level ?? 1) <= 0.3
        ? BatteryLow
        : (battery.level ?? 1) >= 0.8
          ? BatteryFull
          : BatteryMedium;

  const batteryColor = battery.charging
    ? 'text-[var(--accent-green)]'
    : battery.level === null
      ? 'text-[var(--text-secondary)]'
      : battery.level < 0.5
        ? 'text-[var(--accent-red)]'
        : battery.level < 0.7
          ? 'text-[var(--accent-amber)]'
          : 'text-[var(--accent-green)]';

  const pathname = usePathname();
  const isAuthRoute =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/update-password');

  return (
    <div className="flex items-center gap-1.5">
      {!isAuthRoute && (
        <>
          <TaskbarNotificationBell />
          <Link
            href="/hub"
            aria-label="Return to Hub"
            data-testid="taskbar-home-button"
            className={cn(
              'gold-steel-border gold-steel-border-slim flex h-7 w-7 items-center justify-center rounded-full',
              'border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md hover:bg-[var(--material-thin)]',
              'transition-colors active:scale-[0.97]'
            )}
            title="Home — Return to Hub"
          >
            <Home className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          </Link>
        </>
      )}

      <Popover.Root open={trayOpen} onOpenChange={setTrayOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="System Tray Popover"
            aria-haspopup="dialog"
            title="System status & options"
            className={cn(
              'gold-steel-border gold-steel-border-slim flex h-7 cursor-default select-none items-center gap-2 rounded-full px-2.5 outline-none',
              'border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md hover:bg-[var(--material-thin)]',
              'transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.97]'
            )}
          >
            {/* Server health dot */}
            <span className="relative flex h-2 w-2">
              {health.status === 'healthy' && !health.loading && (
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[var(--accent-green)] opacity-75" />
              )}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', healthDotColor)} />
            </span>
            <span
              aria-hidden="true"
              data-testid="system-tray-gold-separator"
              className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
            >
              |
            </span>

            <VolumeIcon className={cn('h-3.5 w-3.5', volumeColor)} />
            <span
              aria-hidden="true"
              data-testid="system-tray-gold-separator"
              className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
            >
              |
            </span>
            <ConnIcon className={cn('h-3.5 w-3.5', connColor)} />
            <span
              aria-hidden="true"
              data-testid="system-tray-gold-separator"
              className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
            >
              |
            </span>
            <div className="flex items-center gap-0.5">
              <BatteryIcon className={cn('h-3.5 w-3.5', batteryColor)} />
              {battery.supported && battery.level !== null && (
                <span className="font-medium text-[11px] text-[var(--text-heading)] leading-none">
                  {Math.round(battery.level * 100)}%
                </span>
              )}
            </div>

            {/* Offline queue pending badge */}
            {offlineQueue.pendingCount > 0 && (
              <>
                <span
                  aria-hidden="true"
                  data-testid="system-tray-gold-separator"
                  className="select-none font-bold font-mono text-[11px] text-accent-amber leading-none drop-shadow-[0_0_4px_rgba(212,175,55,0.45)]"
                >
                  |
                </span>
                <div
                  className="flex animate-pulse items-center gap-1 rounded-full border border-accent-amber/20 bg-accent-amber/10 px-1.5 py-0.5 text-accent-amber"
                  title={`${offlineQueue.pendingCount} offline actions pending sync`}
                >
                  <CloudOff className="h-3 w-3" />
                  <span className="font-semibold text-[10px]">{offlineQueue.pendingCount}</span>
                </div>
              </>
            )}

            <Logo
              variant="gold"
              className={cn(
                'h-3 w-3 shrink-0 transition-transform duration-200 ease-out',
                trayOpen ? 'rotate-0' : 'rotate-180'
              )}
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className={cn(
              'z-popover w-64 rounded-card border border-black/[0.08] bg-white/95 p-3 shadow-window backdrop-blur-2xl',
              'flex select-none flex-col gap-2 focus:outline-none'
            )}
          >
            <div className="space-y-3">
              {/* Server Health Section */}
              <ServerHealthRow
                status={health.status}
                db={health.db}
                redis={health.redis}
                fuxa={health.fuxa}
                responseTime={health.responseTime}
                loading={health.loading}
              />

              <div className="h-[1px] bg-black/[0.05]" />

              {/* Offline Queue Section */}
              <OfflineQueueRow />

              <div className="h-[1px] bg-black/[0.05]" />

              {/* Volume Slider Section */}
              <VolumeControlRow {...volume} />

              <div className="h-[1px] bg-black/[0.05]" />

              {/* Network details Section */}
              <NetworkStatusRow {...network} />

              <div className="h-[1px] bg-black/[0.05]" />

              {/* Battery details Section */}
              <BatteryStatusRow {...battery} />

              <div className="h-[1px] bg-black/[0.05]" />

              {/* Notifications Section */}
              <NotificationRow count={notifications.count} clear={notifications.clear} />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export function SystemTrayPill() {
  return (
    <Suspense fallback={null}>
      <SystemTrayPillInner />
    </Suspense>
  );
}
