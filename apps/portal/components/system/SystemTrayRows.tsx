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
  HardDrive,
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
import type React from 'react';
import { useEffect, useState } from 'react';
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

const DEFAULT_NOTIFICATIONS: SystemNotificationItem[] = [
  {
    id: 'clearance-unlinked',
    title: 'Employee Clearance Notice',
    message: 'No personnel record linked to your account.',
    unread: true,
  },
];

export function TaskbarNotificationBell() {
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
