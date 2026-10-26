'use client';

import * as Popover from '@radix-ui/react-popover';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  CloudOff,
  Home,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useFetchOfflineQueue } from '@/hooks/useFetchOfflineQueue';
import {
  BatteryStatusRow,
  NetworkStatusRow,
  NotificationRow,
  OfflineQueueRow,
  ServerHealthRow,
  TaskbarNotificationBell,
  VolumeControlRow,
} from './SystemTrayRows';
import {
  formatTimeSeconds,
  mapHealthResponseToState,
  useAppVolume,
  useBatteryStatus,
  useNetworkStatus,
  useNotificationCount,
  useServerHealth,
} from './system-tray-hooks';

export {
  BatteryStatusRow,
  formatTimeSeconds,
  mapHealthResponseToState,
  NetworkStatusRow,
  NotificationRow,
  ServerHealthRow,
  VolumeControlRow,
};

/* ─────────────────────────── SystemTrayPill ─────────────────────────── */

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
