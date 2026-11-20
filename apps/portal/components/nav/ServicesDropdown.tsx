'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
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
  LogOut,
  Maximize2,
  Moon,
  RotateCcw,
  ShieldAlert,
  Siren,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchWeather, getWindDirection, type WeatherData } from '@/lib/weather-api';
import { logout } from '~/app/actions';

function formatForecastDay(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

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
//  Safety & active breakdown alerts (backed by Supabase breakdowns)
/* ------------------------------------------------------------------ */
interface SafetyAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

function useSafetyAlerts() {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadActiveAlerts() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from('breakdowns')
          .select('id, reason, status, created_at')
          .in('status', ['open', 'in_progress'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (cancelled || error || !Array.isArray(data)) return;

        setAlerts(
          data.map((row) => ({
            id: String(row.id),
            severity: row.status === 'open' ? 'critical' : 'warning',
            message: typeof row.reason === 'string' && row.reason ? row.reason : 'Active breakdown',
            timestamp: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
          }))
        );
      } catch {
        // Leave alerts empty if Supabase client is unavailable
      }
    }

    void loadActiveAlerts();
    return () => {
      cancelled = true;
    };
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return { alerts, criticalCount, warningCount, total: alerts.length };
}

/**
 * System Tray toggle – unified services menu for mining operations.
 * Shows environmental conditions, shift status, safety alerts,
 * and quick emergency actions.
 */
export function ServicesDropdown({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const [open, setOpen] = useState(false);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [showWeeklyForecast, setShowWeeklyForecast] = useState(false);

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
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setShowWeeklyForecast(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label="System Tray"
          aria-haspopup="menu"
          aria-expanded={open}
          title="System Tray (Alt+S)"
          className={cn(
            'relative flex cursor-default select-none items-center justify-center rounded-full text-[var(--text-secondary)] transition-all duration-150 ease-in-out focus-visible:outline-none',
            embedded
              ? 'h-5 w-5 hover:text-[var(--text-heading)] active:scale-[0.95]'
              : 'gold-steel-border gold-steel-border-slim h-7 w-7 border border-white/20 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md hover:bg-[var(--material-thin)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.97]',
            open && !embedded && 'bg-[var(--material-thin)]'
          )}
        >
          <Logo
            variant="gold"
            className={cn(
              embedded ? 'h-3.5 w-3.5' : 'h-4 w-4',
              'transition-transform duration-200 ease-out',
              open ? 'rotate-0' : 'rotate-180'
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn(
          'z-popover rounded-xl border border-black/[0.08] bg-white/95 py-2 shadow-window backdrop-blur-2xl transition-[width] duration-150',
          showWeeklyForecast ? 'w-80' : 'w-64'
        )}
        align="end"
        sideOffset={5}
      >
        {/* ── Environmental & Operations Status ── */}
        <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
          {/* Weather */}
          <button
            type="button"
            onClick={() => setShowWeeklyForecast((prev) => !prev)}
            aria-expanded={showWeeklyForecast}
            aria-label="Toggle 7-day weather forecast"
            data-testid="weather-panel-toggle"
            className={cn(
              'rounded-lg border p-2 text-left transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50',
              showWeeklyForecast
                ? 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/5'
                : 'border-black/[0.04] bg-black/[0.02]'
            )}
          >
            {weatherLoading || !weather ? (
              <div className="flex items-center gap-2">
                <CloudSun className="h-4 w-4 animate-pulse text-[var(--text-muted)]" />
                <span className="text-[11px] text-[var(--text-muted)]">Loading…</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{weather.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[12px] text-[var(--text-heading)]">
                    {weather.temperature}°C
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-muted)]">
                    {weather.description}
                  </div>
                </div>
              </div>
            )}
          </button>

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
          <button
            type="button"
            onClick={() => setShowWeeklyForecast((prev) => !prev)}
            aria-expanded={showWeeklyForecast}
            aria-label="Toggle 7-day weather forecast from conditions"
            className={cn(
              'col-span-2 rounded-lg border p-2 text-left transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50',
              showWeeklyForecast
                ? 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/5'
                : 'border-black/[0.04] bg-black/[0.02]'
            )}
          >
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
          </button>

          {showWeeklyForecast && (
            <div
              data-testid="weekly-weather-forecast-panel"
              className="col-span-2 space-y-1.5 rounded-lg border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/[0.04] p-2.5"
            >
              <div className="flex items-center justify-between border-black/[0.06] border-b pb-1">
                <span className="font-semibold text-[11px] text-[var(--text-heading)]">
                  7-Day Site Forecast
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {weather?.location.name ?? 'Delmas, Mpumalanga'}
                </span>
              </div>
              {weather?.daily && weather.daily.length > 0 ? (
                <div className="space-y-1">
                  {weather.daily.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[11px] hover:bg-black/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="w-12 shrink-0 font-medium text-[var(--text-heading)]">
                          {formatForecastDay(day.date)}
                        </span>
                        <span className="text-sm leading-none" aria-hidden="true">
                          {day.icon}
                        </span>
                        <span className="truncate text-[10px] text-[var(--text-muted)]">
                          {day.description}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 font-mono text-[10.5px] tabular-nums">
                        {day.precipitation > 0 && (
                          <span className="text-[var(--accent-blue)]">
                            {day.precipitation.toFixed(1)}mm
                          </span>
                        )}
                        <span className="text-[var(--text-muted)]">{day.minTemp}°</span>
                        <span className="font-semibold text-[var(--text-heading)]">
                          {day.maxTemp}°
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-1 text-[11px] text-[var(--text-muted)]">
                  Weekly forecast unavailable.
                </p>
              )}
            </div>
          )}

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
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
