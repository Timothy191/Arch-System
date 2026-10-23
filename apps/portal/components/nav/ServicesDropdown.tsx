'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import {
  ClipboardList,
  CloudSun,
  Lock,
  LogOut,
  Maximize2,
  Moon,
  Phone,
  PowerOff,
  RotateCcw,
  ShieldAlert,
  Siren,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchWeather, getWindDirection, type WeatherData } from '@/lib/weather-api';
import { logout } from '~/app/actions';

/* ------------------------------------------------------------------ */
//  Shift helpers
/* ------------------------------------------------------------------ */
interface ShiftInfo {
  label: string;
  hoursRemaining: number;
  isDay: boolean;
}

function getShiftInfo(): ShiftInfo {
  const now = new Date();
  const hour = now.getHours();
  const isDay = hour >= 6 && hour < 18;
  const hoursRemaining = isDay ? 18 - hour : hour >= 18 ? 30 - hour : 6 - hour;
  return {
    label: isDay ? 'Day Shift' : 'Night Shift',
    hoursRemaining,
    isDay,
  };
}

/* ------------------------------------------------------------------ */
//  Safety alerts (localStorage-backed mock for demo)
/* ------------------------------------------------------------------ */
interface SafetyAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

function useSafetyAlerts() {
  const [alerts, _setAlerts] = useState<SafetyAlert[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('arch-safety-alerts');
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    // Seed realistic mining alerts on first load
    const seed: SafetyAlert[] = [
      {
        id: 'sa-1',
        severity: 'warning',
        message: 'High dust levels — Pit B',
        timestamp: Date.now() - 3600000,
      },
      {
        id: 'sa-2',
        severity: 'info',
        message: 'Blasting hold lifted — Sector 4',
        timestamp: Date.now() - 7200000,
      },
    ];
    window.localStorage.setItem('arch-safety-alerts', JSON.stringify(seed));
    return seed;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return { alerts, criticalCount, warningCount, total: alerts.length };
}

/**
 * System Tray toggle – unified services menu for mining operations.
 * Shows environmental conditions, shift status, safety alerts,
 * and quick emergency actions.
 */
export function ServicesDropdown() {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [shutDown, setShutDown] = useState(false);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const shift = useMemo(() => getShiftInfo(), []);
  const safety = useSafetyAlerts();

  useEffect(() => {
    let cancelled = false;
    fetchWeather(-26.35914, 28.79267, 'Delmas, Mpumalanga')
      .then((data) => {
        if (!cancelled) {
          setWeather(data);
          setWeatherLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="System Tray"
            aria-haspopup="menu"
            aria-expanded={open}
            title="System Tray (Alt+S)"
            className={cn(
              'gold-steel-border gold-steel-border-slim relative flex h-7 w-7 items-center justify-center rounded-full',
              'border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md hover:bg-[var(--material-thin)]',
              'text-[var(--text-secondary)]',
              'active:scale-[0.97]',
              'transition-all duration-150 ease-in-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50',
              'cursor-default select-none',
              open && 'bg-[var(--material-thin)]'
            )}
          >
            <Logo
              variant="gold"
              className={cn(
                'h-4 w-4 transition-transform duration-200 ease-out',
                open ? 'rotate-0' : 'rotate-180'
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="z-popover w-64 rounded-xl border border-black/[0.08] bg-white/95 py-2 shadow-window backdrop-blur-2xl"
          align="end"
          sideOffset={5}
        >
          {/* ── Environmental & Operations Status ── */}
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
            {/* Weather */}
            <div className="rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              {weatherLoading || !weather ? (
                <div className="flex items-center gap-2">
                  <CloudSun className="h-4 w-4 animate-pulse text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">Loading…</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{weather.icon}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[12px] text-[var(--text-heading)]">
                      {weather.temperature}°C
                    </div>
                    <div className="truncate text-[10px] text-[var(--text-muted)]">
                      {weather.description}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shift */}
            <div className="rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              <div className="flex items-center gap-2">
                {shift.isDay ? (
                  <Sun className="h-4 w-4 shrink-0 text-[var(--accent-orange)]" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0 text-[var(--accent-blue)]" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-[12px] text-[var(--text-heading)]">
                    {shift.label}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {shift.hoursRemaining}h remaining
                  </div>
                </div>
              </div>
            </div>

            {/* Wind / Visibility */}
            <div className="col-span-2 rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              {weatherLoading || !weather ? (
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 animate-pulse text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">Loading conditions…</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                  <span className="text-[12px] text-[var(--text-heading)]">
                    {weather.windSpeed} km/h
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {getWindDirection(weather.windDirection)}
                  </span>
                  <span className="ml-auto font-medium text-[10px] text-[var(--accent-green)]">
                    Visibility OK
                  </span>
                </div>
              )}
            </div>

            {/* Safety Alert Summary */}
            <div className="col-span-2 rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={cn(
                    'h-4 w-4 shrink-0',
                    safety.criticalCount > 0
                      ? 'text-[var(--accent-red)]'
                      : safety.warningCount > 0
                        ? 'text-[var(--accent-orange)]'
                        : 'text-[var(--accent-green)]'
                  )}
                />
                <span className="flex-1 text-[12px] text-[var(--text-heading)]">
                  {safety.total === 0
                    ? 'No active alerts'
                    : `${safety.total} active alert${safety.total === 1 ? '' : 's'}`}
                </span>
                {safety.criticalCount > 0 && (
                  <span className="rounded-full bg-[var(--accent-red)] px-1.5 py-0.5 font-bold text-[10px] text-white">
                    {safety.criticalCount}
                  </span>
                )}
                {safety.warningCount > 0 && safety.criticalCount === 0 && (
                  <span className="rounded-full bg-[var(--accent-orange)] px-1.5 py-0.5 font-bold text-[10px] text-white">
                    {safety.warningCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-black/[0.06]" />

          {/* ── View Submenu ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 font-medium text-[13px] text-[var(--text-heading)] hover:bg-black/[0.04] focus:bg-black/[0.04]">
              <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span>View</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="z-popover w-48 rounded-xl border border-black/[0.08] bg-white/95 py-1 shadow-window backdrop-blur-2xl">
                <DropdownMenuItem
                  className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  onSelect={() => window.location.reload()}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[13px] text-[var(--text-heading)]">Reload</span>
                  <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘R</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  onSelect={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    } else if (document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[13px] text-[var(--text-heading)]">
                    Toggle Fullscreen
                  </span>
                  <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘F</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* ── Safety & Emergency (replaces Help) ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 font-medium text-[13px] text-[var(--text-heading)] hover:bg-black/[0.04] focus:bg-black/[0.04]">
              <Siren className="h-3.5 w-3.5 text-[var(--accent-red)]" />
              <span>Safety &amp; Emergency</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="z-popover w-52 rounded-xl border border-black/[0.08] bg-white/95 py-1 shadow-window backdrop-blur-2xl">
                <DropdownMenuItem
                  className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  onSelect={() => {
                    window.location.href = '/control-room/hourly-loads';
                  }}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[13px] text-[var(--text-heading)]">
                    Control Room Telemetry
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
                  onSelect={() => {
                    window.location.href = '/control-room';
                  }}
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[13px] text-[var(--text-heading)]">
                    Control Room Dashboard
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-1 my-1 bg-black/[0.06]" />
                <DropdownMenuItem
                  className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent-red/10 focus:bg-accent-red/10"
                  onSelect={() => window.open('tel:+27170000000', '_self')}
                >
                  <Phone className="h-3.5 w-3.5 text-accent-red" />
                  <span className="font-medium text-[13px] text-accent-red">Emergency Line</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-black/[0.06]" />

          {/* ── Power Options ── */}
          <DropdownMenuItem
            className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
            onSelect={() => setLocked(true)}
          >
            <Lock className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="font-medium text-[13px] text-[var(--text-heading)]">Lock Screen</span>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘Q</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
            onSelect={() => setSleeping(true)}
          >
            <Moon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="font-medium text-[13px] text-[var(--text-heading)]">Sleep</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-black/[0.06]" />

          <form action={logout}>
            <DropdownMenuItem
              asChild
              className="mx-1 my-0.5 cursor-default rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04]"
            >
              <button type="submit" className="flex w-full items-center gap-2.5 px-2 py-1.5">
                <LogOut className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <span className="font-medium text-[13px] text-[var(--text-heading)]">Log Out</span>
                <span className="ml-auto text-[11px] text-[var(--text-muted)]">⇧⌘Q</span>
              </button>
            </DropdownMenuItem>
          </form>

          <DropdownMenuItem
            className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-black/[0.04] focus:bg-black/[0.04]"
            onSelect={() => window.location.reload()}
          >
            <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="font-medium text-[13px] text-[var(--text-heading)]">Restart…</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-1 my-1.5 bg-black/[0.06]" />

          <DropdownMenuItem
            className="mx-1 my-0.5 flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent-red/10 focus:bg-accent-red/10"
            onSelect={() => setShutDown(true)}
          >
            <PowerOff className="h-3.5 w-3.5 text-accent-red" />
            <span className="font-medium text-[13px] text-accent-red">Shut Down…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Screen Lock Overlay ── */}
      {locked && (
        <div
          role="dialog"
          aria-label="Screen locked"
          className="fixed inset-0 z-priority flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/20 backdrop-blur-xl"
          onClick={() => setLocked(false)}
        >
          <Lock className="h-8 w-8 text-white/60" />
          <span className="font-medium text-sm text-white/60">Click anywhere to unlock</span>
        </div>
      )}

      {/* ── Sleep Overlay ── */}
      {sleeping && (
        <div
          role="dialog"
          aria-label="System sleeping"
          className="fixed inset-0 z-priority flex cursor-pointer flex-col items-center justify-center gap-3 bg-black"
          onClick={() => setSleeping(false)}
        >
          <Moon className="h-8 w-8 text-white/40" />
          <span className="font-medium text-sm text-white/40">Click anywhere to wake</span>
        </div>
      )}

      {/* ── Shut Down Overlay ── */}
      {shutDown && (
        <div
          role="dialog"
          aria-label="System shut down"
          className="fixed inset-0 z-priority flex flex-col items-center justify-center gap-3 bg-black"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="rgba(255,255,255,0.3)"
            aria-hidden="true"
          >
            <path d="M12 2L2 22h4.5L12 8.5 17.5 22H22L12 2z" />
          </svg>
          <span className="font-medium text-sm text-white/60">
            It is now safe to turn off your computer.
          </span>
        </div>
      )}
    </>
  );
}
