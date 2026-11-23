'use client';

import * as Popover from '@radix-ui/react-popover';
import { cn } from '@repo/ui/lib/utils';
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
  Gauge,
  HardDrive,
  MinusCircle,
  RefreshCw,
  ShieldCheck,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useFetchOfflineQueue } from '@/hooks/useFetchOfflineQueue';
import {
  formatTimeSeconds,
  type HealthState,
  type useAppVolume,
  type useBatteryStatus,
  type useNetworkStatus,
  type useNotificationCount,
} from './system-tray-hooks';

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
  const [tunnelEnabled, setTunnelEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('arch-cf-tunnel-enabled') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncTunnelState = () => {
      setTunnelEnabled(window.localStorage.getItem('arch-cf-tunnel-enabled') === 'true');
    };
    window.addEventListener('arch-cf-tunnel-change', syncTunnelState);
    window.addEventListener('storage', syncTunnelState);
    return () => {
      window.removeEventListener('arch-cf-tunnel-change', syncTunnelState);
      window.removeEventListener('storage', syncTunnelState);
    };
  }, []);
  const [speedTestState, setSpeedTestState] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    latencyMs?: number;
    mbps?: number;
  }>({ status: 'idle' });
  const [troubleshootState, setTroubleshootState] = useState<{
    status: 'idle' | 'running' | 'done';
    checks: Array<{ label: string; ok: boolean; detail: string }>;
  }>({ status: 'idle', checks: [] });

  const ConnQualityIcon = !online
    ? WifiOff
    : effectiveType === '4g' || effectiveType === '3g'
      ? SignalHigh
      : effectiveType === '2g'
        ? SignalMedium
        : effectiveType === 'slow-2g'
          ? SignalLow
          : Wifi;

  const toggleTunnel = () => {
    setTunnelEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('arch-cf-tunnel-enabled', String(next));
        window.dispatchEvent(new Event('arch-cf-tunnel-change'));
      }
      return next;
    });
  };

  const runSpeedTest = async () => {
    setSpeedTestState({ status: 'running' });
    const startedAt = performance.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const text = await res.text();
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      const payloadBits = Math.max(8192, text.length * 8);
      const measuredMbps = Math.round((payloadBits / (elapsedMs / 1000) / 1_000_000) * 10) / 10;
      setSpeedTestState({
        status: res.ok ? 'done' : 'error',
        latencyMs: elapsedMs,
        mbps: Math.max(measuredMbps, downlink ?? 1.2),
      });
    } catch {
      setSpeedTestState({ status: 'error' });
    }
  };

  const runTroubleshoot = async () => {
    setTroubleshootState({ status: 'running', checks: [] });
    const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const startedAt = performance.now();
    let apiOk = false;
    let latencyMs = 0;
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      latencyMs = Math.round(performance.now() - startedAt);
      apiOk = res.ok;
    } catch {
      apiOk = false;
    }
    setTroubleshootState({
      status: 'done',
      checks: [
        {
          label: 'Browser Link',
          ok: browserOnline,
          detail: browserOnline ? 'Online' : 'Offline',
        },
        {
          label: 'Portal Edge',
          ok: apiOk,
          detail: apiOk ? `${latencyMs} ms` : 'Unreachable',
        },
        {
          label: 'Latency',
          ok: apiOk && latencyMs < 500,
          detail: latencyMs < 500 ? 'Healthy' : 'High RTT',
        },
      ],
    });
  };

  return (
    <div className="space-y-2 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-2.5">
        <ConnQualityIcon
          className={cn(
            'h-4 w-4 shrink-0',
            online ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-medium text-[12px] text-[var(--text-heading)]">
              {online ? 'Connected' : 'Offline'}
            </span>
            <div className="flex items-center gap-1">
              {tunnelEnabled && (
                <span className="rounded bg-orange-100 px-1 py-0.5 font-semibold text-[9px] text-orange-700">
                  CF Tunnel
                </span>
              )}
              {effectiveType && (
                <span className="text-[10px] text-[var(--text-muted)] uppercase">
                  {effectiveType}
                </span>
              )}
            </div>
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

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={toggleTunnel}
          data-testid="network-cf-tunnel-toggle"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium text-[10px] transition-colors',
            tunnelEnabled
              ? 'border-orange-300 bg-orange-50 text-orange-700'
              : 'border-black/[0.08] bg-black/[0.02] text-[var(--text-secondary)] hover:bg-black/[0.05]'
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {tunnelEnabled ? 'CF Tunnel On' : 'CF Tunnel'}
        </button>
        <button
          type="button"
          onClick={() => void runSpeedTest()}
          disabled={speedTestState.status === 'running'}
          data-testid="network-speed-test-button"
          className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-black/[0.02] px-1.5 py-0.5 font-medium text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] disabled:opacity-50"
        >
          <Gauge className="h-3 w-3" />
          {speedTestState.status === 'running' ? 'Testing…' : 'Speed Test'}
        </button>
        <button
          type="button"
          onClick={() => void runTroubleshoot()}
          disabled={troubleshootState.status === 'running'}
          data-testid="network-troubleshoot-button"
          className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-black/[0.02] px-1.5 py-0.5 font-medium text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] disabled:opacity-50"
        >
          <Wrench className="h-3 w-3" />
          Troubleshoot
        </button>
      </div>

      {speedTestState.status === 'done' && (
        <div
          data-testid="network-speed-test-result"
          className="flex items-center justify-between rounded-md bg-emerald-50/70 px-2 py-1 font-mono text-[10px] text-emerald-800"
        >
          <span>Edge RTT: {speedTestState.latencyMs} ms</span>
          <span>Est: {speedTestState.mbps} Mbps</span>
        </div>
      )}
      {speedTestState.status === 'error' && (
        <p className="text-[10px] text-[var(--accent-red)]">
          Speed test failed — check connection.
        </p>
      )}

      {troubleshootState.status === 'done' && (
        <div
          data-testid="network-troubleshoot-result"
          className="space-y-0.5 rounded-md border border-black/[0.06] bg-black/[0.02] px-2 py-1 text-[10px]"
        >
          {troubleshootState.checks.map((chk) => (
            <div key={chk.label} className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">{chk.label}</span>
              <span
                className={chk.ok ? 'font-medium text-emerald-700' : 'font-medium text-rose-600'}
              >
                {chk.detail}
              </span>
            </div>
          ))}
          <Link
            href="/admin/cloudflare"
            className="mt-1 block font-medium text-[9.5px] text-[var(--accent-blue)] hover:underline"
          >
            Open Cloudflare Edge Diagnostics →
          </Link>
        </div>
      )}
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
  const volumeColor = muted || volume === 0 ? 'text-[var(--text-muted)]' : 'text-accent-gold';

  return (
    <div
      data-testid="volume-control-row"
      className="space-y-1.5 rounded-lg border border-accent-gold/30 bg-accent-gold/[0.08] px-2.5 py-2"
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="rounded-md p-0.5 transition-colors hover:bg-accent-gold/15"
        >
          <VolumeIcon className={cn('h-4 w-4', volumeColor)} />
        </button>
        <span className={cn('min-w-[2rem] font-semibold text-[12px]', volumeColor)}>
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
        className="h-1 w-full accent-[var(--accent-gold)]"
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
  fuxaMode,
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
        <HealthSubRow
          label={fuxaMode === 'in-codebase' ? 'SCADA (In-App)' : 'SCADA (FUXA)'}
          status={fuxa}
          icon={Zap}
        />
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

export function OfflineQueueRow() {
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

interface SystemNotificationItem {
  id: string;
  title: string;
  message: string;
  unread: boolean;
}

export function TaskbarNotificationBell({ embedded = false }: { embedded?: boolean } = {}) {
  const [items, setItems] = useState<SystemNotificationItem[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    async function loadLiveNotifications() {
      try {
        const { createBrowserSupabaseClient } = await import('@repo/supabase/client');
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from('breakdowns')
          .select('id, reason, status, created_at')
          .in('status', ['open', 'in_progress'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (cancelled || error || !Array.isArray(data)) return;

        setItems(
          data.map((row) => ({
            id: `breakdown-${String(row.id)}`,
            title: row.status === 'open' ? 'Open Breakdown Alert' : 'Breakdown In Progress',
            message: typeof row.reason === 'string' && row.reason ? row.reason : 'Active breakdown',
            unread: row.status === 'open',
          }))
        );
      } catch {
        // Leave notifications empty if Supabase client is unavailable
      }
    }

    void loadLiveNotifications();

    const handleNotification = (event: Event) => {
      const custom = event as CustomEvent<SystemNotificationItem>;
      const detail = custom.detail;
      if (!detail?.id || !detail?.message) return;

      setItems((prev) => {
        const exists = prev.some((item) => item.id === detail.id);
        return exists
          ? prev.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
          : [detail, ...prev];
      });
    };

    window.addEventListener('arch-system-notification', handleNotification);
    return () => {
      cancelled = true;
      window.removeEventListener('arch-system-notification', handleNotification);
    };
  }, []);

  const unreadCount = items.filter((i) => i.unread).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
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
            embedded
              ? 'relative flex h-5 w-5 items-center justify-center rounded-full text-accent-gold transition-colors hover:text-accent-gold-hover focus-visible:outline-none active:scale-[0.95]'
              : 'gold-steel-border gold-steel-border-slim relative flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md transition-colors hover:bg-[var(--material-thin)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 active:scale-[0.97]'
          )}
        >
          <Bell className="h-3.5 w-3.5 text-accent-gold" />
          {unreadCount > 0 && (
            <span
              data-testid="notification-unread-dot"
              aria-label={`${unreadCount} unread notifications`}
              className={cn(
                'absolute h-2 w-2 rounded-full bg-[var(--accent-red)] ring-1 ring-white',
                embedded ? '-top-0.5 -right-0.5' : 'top-1 right-1'
              )}
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

interface DetectedWifiProfile {
  readonly id: string;
  readonly ssid: string;
  readonly security: 'WPA3-Enterprise' | 'Zero Trust Tunnel' | 'WPA2';
  readonly signalLabel: string;
  readonly detail: string;
}

export function WifiNetworkPopover({
  network,
  embedded = false,
}: {
  readonly network: ReturnType<typeof useNetworkStatus>;
  readonly embedded?: boolean;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'site-primary';
    return window.localStorage.getItem('arch-wifi-profile') ?? 'site-primary';
  });
  const [isScanning, setIsScanning] = useState(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  const ConnIcon = !network.online ? WifiOff : Wifi;
  const connColor = network.online ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';

  const detectedProfiles: readonly DetectedWifiProfile[] = [
    {
      id: 'site-primary',
      ssid: network.connType === 'cellular' ? 'Site-LTE-4G-Uplink' : 'Arch-Plant-Control-5G',
      security: 'WPA3-Enterprise',
      signalLabel:
        typeof network.downlink === 'number' ? `${network.downlink.toFixed(1)} Mbps` : 'Strong',
      detail:
        typeof network.rtt === 'number'
          ? `${network.effectiveType?.toUpperCase() ?? 'WiFi'} · ${network.rtt} ms`
          : 'Primary site uplink',
    },
    {
      id: 'cf-tunnel',
      ssid: 'Cloudflare-ZeroTrust-Tunnel',
      security: 'Zero Trust Tunnel',
      signalLabel: 'Encrypted',
      detail: 'WARP / Argo edge routing',
    },
    {
      id: 'pit-mesh',
      ssid: 'Delmas-Pit-Mesh-Backup',
      security: 'WPA2',
      signalLabel: 'Standby',
      detail: 'Field tablet failover mesh',
    },
  ];

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('arch-wifi-profile', id);
      window.localStorage.setItem('arch-cf-tunnel-enabled', String(id === 'cf-tunnel'));
      window.dispatchEvent(new Event('arch-cf-tunnel-change'));
    }
  };

  const handleScan = () => {
    setIsScanning(true);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
    }, 500);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Wi-Fi and Network Menu"
          title="Wi-Fi & Network"
          data-testid="taskbar-wifi-trigger"
          className={cn(
            'relative flex cursor-default select-none items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.95]',
            embedded ? 'h-5 w-5' : 'h-6 w-6'
          )}
        >
          <ConnIcon className={cn('h-3.5 w-3.5', connColor)} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          data-testid="taskbar-wifi-menu"
          className="z-popover flex w-72 select-none flex-col gap-2.5 rounded-card border border-black/[0.08] bg-white/95 p-3 shadow-window backdrop-blur-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-black/[0.06] border-b pb-2">
            <div className="flex items-center gap-2">
              <ConnIcon className={cn('h-4 w-4', connColor)} />
              <div>
                <p className="font-semibold text-[12px] text-[var(--text-heading)]">
                  Wi-Fi &amp; Networks
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {network.online ? 'Connected' : 'Offline'}
                  {network.effectiveType ? ` · ${network.effectiveType.toUpperCase()}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleScan}
              aria-label="Scan Wi-Fi networks"
              className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-black/[0.02] px-2 py-1 font-medium text-[10px] text-[var(--text-secondary)] hover:bg-black/[0.05]"
            >
              <RefreshCw className={cn('h-3 w-3', isScanning && 'animate-spin')} />
              Scan
            </button>
          </div>

          <div className="space-y-1.5">
            {detectedProfiles.map((profile) => {
              const isActive = selectedProfileId === profile.id && network.online;
              return (
                <div
                  key={profile.id}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                    isActive
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Wifi
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isActive ? 'text-emerald-600' : 'text-[var(--text-secondary)]'
                        )}
                      />
                      <span className="truncate font-semibold text-[11px] text-[var(--text-heading)]">
                        {profile.ssid}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] text-[var(--text-muted)]">
                      {profile.security} · {profile.detail}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[9.5px] text-[var(--text-secondary)]">
                      {profile.signalLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectProfile(profile.id)}
                      className={cn(
                        'rounded px-1.5 py-0.5 font-semibold text-[9.5px] transition-colors',
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'border border-black/[0.1] bg-white text-[var(--text-heading)] hover:bg-zinc-50'
                      )}
                    >
                      {isActive ? 'Active' : 'Connect'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-black/[0.06] border-t pt-2">
            <NetworkStatusRow {...network} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
