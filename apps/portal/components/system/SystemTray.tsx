'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArchLogoBadge } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { ArchSeparator } from '@repo/ui/Separator';
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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { useFetchOfflineQueue } from '@/hooks/useFetchOfflineQueue';
import {
  BatteryStatusRow,
  NetworkStatusRow,
  NotificationRow,
  OfflineQueueRow,
  ServerHealthRow,
  TaskbarNotificationBell,
  VolumeControlRow,
  WifiNetworkPopover,
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

const SystemTrayPillInner = function SystemTrayPillInner({
  embedded = false,
}: {
  readonly embedded?: boolean;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const network = useNetworkStatus();
  const battery = useBatteryStatus();
  const volume = useAppVolume();
  const notifications = useNotificationCount();
  const health = useServerHealth();
  const offlineQueue = useFetchOfflineQueue();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHealthy = mounted && health.status === 'healthy' && !health.loading;
  const healthDotColor =
    !mounted || health.loading
      ? 'bg-[var(--text-muted)]'
      : health.status === 'healthy'
        ? 'bg-[var(--accent-green)]'
        : health.status === 'degraded'
          ? 'bg-[var(--accent-blue)]'
          : 'bg-[var(--accent-red)]';

  const VolumeIcon =
    volume.muted || volume.volume === 0 ? VolumeX : volume.volume < 50 ? Volume1 : Volume2;
  const volumeColor =
    volume.muted || volume.volume === 0 ? 'text-accent-gold/55' : 'text-accent-gold';

  const BatteryIcon = battery.charging
    ? BatteryCharging
    : (battery.level ?? 1) <= 0.1
      ? BatteryWarning
      : (battery.level ?? 1) <= 0.3
        ? BatteryLow
        : (battery.level ?? 1) >= 0.8
          ? BatteryFull
          : BatteryMedium;

  const batteryColor =
    !battery.charging && battery.level !== null && battery.level < 0.2
      ? 'text-[var(--accent-red)]'
      : 'text-accent-gold';

  const pathname = usePathname();
  const isAuthRoute =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/update-password');

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        !embedded &&
          'gold-steel-border gold-steel-border-slim h-7 rounded-full border border-white/20 bg-[var(--material-ultra-thin)] px-2.5 shadow-diffusion-sm backdrop-blur-md transition-colors'
      )}
    >
      {!isAuthRoute && (
        <>
          <Link
            href="/hub"
            aria-label="Return to Hub"
            data-testid="taskbar-home-button"
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full',
              'text-accent-gold hover:text-accent-gold-hover',
              'transition-colors active:scale-[0.95]'
            )}
            title="Home — Return to Hub"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>

          <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

          <TaskbarNotificationBell embedded />

          <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />
        </>
      )}

      <Popover.Root open={trayOpen} onOpenChange={setTrayOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            title="System status & options"
            className={cn(
              'flex cursor-default select-none items-center gap-2 outline-none',
              'transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.98]'
            )}
          >
            <span className="sr-only">System tray</span>
            {/* Server health dot */}
            <span className="relative flex h-2 w-2" suppressHydrationWarning>
              {isHealthy && (
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[var(--accent-green)] opacity-75" />
              )}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', healthDotColor)} />
            </span>
            <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

            <VolumeIcon className={cn('h-3.5 w-3.5', volumeColor)} />
            <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />
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
                <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />
                <div
                  className="flex animate-pulse items-center gap-1 rounded-full border border-accent-gold/35 bg-accent-gold/10 px-1.5 py-0.5 text-accent-gold"
                  title={`${offlineQueue.pendingCount} offline actions pending sync`}
                >
                  <CloudOff className="h-3 w-3" />
                  <span className="font-semibold text-[10px]">{offlineQueue.pendingCount}</span>
                </div>
              </>
            )}

            <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />
            <ArchLogoBadge
              size="xs"
              className={cn(
                'transition-transform duration-200 ease-out',
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
              {/* Quick Navigation Hub & Arch OS indicator */}
              <div className="flex items-center justify-between border-black/[0.06] border-b pb-2">
                <Link
                  href="/hub"
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[var(--text-secondary)] text-xs transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]"
                  title="Return to Hub"
                >
                  <Home className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                  <span className="font-medium text-[11px]">Return to Hub</span>
                </Link>
                <div className="font-mono text-[10px] text-[var(--text-muted)]">Arch OS</div>
              </div>

              {/* Server Health Section */}
              <ServerHealthRow
                status={health.status}
                db={health.db}
                redis={health.redis}
                fuxa={health.fuxa}
                fuxaMode={health.fuxaMode}
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

      <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

      <WifiNetworkPopover network={network} embedded />

      <ArchSeparator variant="pipe" testId="system-tray-gold-separator" />

      <FeedbackWidget variant="header" embedded />
    </div>
  );
};

export function SystemTrayPill({ embedded = false }: { readonly embedded?: boolean } = {}) {
  return (
    <Suspense fallback={null}>
      <SystemTrayPillInner embedded={embedded} />
    </Suspense>
  );
}
