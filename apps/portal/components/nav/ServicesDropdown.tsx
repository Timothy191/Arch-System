"use client";

import { useState, useEffect, useMemo } from "react";
import { logout } from "~/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import {
  LogOut,
  RotateCcw,
  PowerOff,
  Lock,
  Moon,
  Maximize2,
  ChevronDown,
  Sun,
  CloudSun,
  Wind,
  ShieldAlert,
  Phone,
  ClipboardList,
  Siren,
  MessageCircle,
  PanelRight,
} from "lucide-react";
import { fetchWeather, getWeatherAlert, getWindDirection, type WeatherData } from "@/lib/weather-api";
import { openWhatsAppSplitView, openWhatsAppWebWindow } from "@/lib/communications/whatsapp";

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
    label: isDay ? "Day Shift" : "Night Shift",
    hoursRemaining,
    isDay,
  };
}

/* ------------------------------------------------------------------ */
//  Safety alerts (localStorage-backed mock for demo)
/* ------------------------------------------------------------------ */
interface SafetyAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: number;
}

function useSafetyAlerts() {
  const [alerts, _setAlerts] = useState<SafetyAlert[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("arch-safety-alerts");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    // Seed realistic mining alerts on first load
    const seed: SafetyAlert[] = [
      {
        id: "sa-1",
        severity: "warning",
        message: "High dust levels — Pit B",
        timestamp: Date.now() - 3600000,
      },
      {
        id: "sa-2",
        severity: "info",
        message: "Blasting hold lifted — Sector 4",
        timestamp: Date.now() - 7200000,
      },
    ];
    window.localStorage.setItem("arch-safety-alerts", JSON.stringify(seed));
    return seed;
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return { alerts, criticalCount, warningCount, total: alerts.length };
}

/**
 * System Tray toggle – unified services menu for mining operations.
 * Shows environmental conditions, shift status, safety alerts,
 * and quick emergency actions.
 */
export function ServicesDropdown({ variant = "inline" }: { variant?: "inline" | "pill" }) {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [shutDown, setShutDown] = useState(false);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const shift = useMemo(() => getShiftInfo(), [open]);
  const safety = useSafetyAlerts();
  const weatherAlert = weather ? getWeatherAlert(weather) : null;

  useEffect(() => {
    let cancelled = false;
    fetchWeather(-26.35914, 28.79267, "Delmas, Mpumalanga")
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
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
              variant === "inline"
                ? "inline-flex items-center justify-center h-full p-0 bg-transparent border-0 text-[var(--text-heading)] hover:opacity-80 data-[state=open]:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold-edge)]/50 cursor-default select-none transition-opacity duration-150"
                : "brand-chrome-pill relative flex items-center justify-center w-7 h-7 rounded-[8px] text-[var(--text-secondary)] opacity-90 hover:bg-[var(--brand-silver-glow)] hover:opacity-100 data-[state=open]:bg-[var(--brand-silver-glow)] data-[state=open]:opacity-100 transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold-edge)] cursor-default select-none",
            )}
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200 ease-out",
                open && "rotate-180",
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-64 bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-xl py-2"
          align="end"
          sideOffset={5}
        >
          {/* ── Environmental & Operations Status ── */}
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
            {/* Weather */}
            <div className="bg-black/[0.02] border border-black/[0.04] rounded-lg p-2 relative">
              {weatherLoading || !weather ? (
                <div className="flex items-center gap-2">
                  <CloudSun className="w-4 h-4 text-[var(--text-muted)] animate-pulse" />
                  <span className="text-[11px] text-[var(--text-muted)]">Loading…</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{weather.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--text-heading)]">
                      {weather.temperature}°C
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {weather.description}
                      {weather.location.name ? ` · ${weather.location.name}` : ""}
                    </div>
                  </div>
                  {weatherAlert && weatherAlert.level !== "none" && (
                    <span
                      className={cn(
                        "absolute top-1.5 right-1.5 w-2 h-2 rounded-full",
                        weatherAlert.level === "critical"
                          ? "bg-[var(--accent-red)] animate-pulse"
                          : "bg-[var(--accent-orange)]",
                      )}
                      title={weatherAlert.message}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Shift */}
            <div className="bg-black/[0.02] border border-black/[0.04] rounded-lg p-2">
              <div className="flex items-center gap-2">
                {shift.isDay ? (
                  <Sun className="w-4 h-4 text-[var(--accent-orange)] shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--text-heading)]">
                    {shift.label}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {shift.hoursRemaining}h remaining
                  </div>
                </div>
              </div>
            </div>

            {/* Wind / Visibility */}
            <div className="col-span-2 bg-black/[0.02] border border-black/[0.04] rounded-lg p-2">
              {weatherLoading || !weather ? (
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-[var(--text-muted)] animate-pulse" />
                  <span className="text-[11px] text-[var(--text-muted)]">Loading conditions…</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                  <span className="text-[12px] text-[var(--text-heading)]">
                    {weather.windSpeed} km/h
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {getWindDirection(weather.windDirection)}
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--accent-green)] font-medium">
                    Visibility OK
                  </span>
                </div>
              )}
            </div>

            {/* Safety Alert Summary */}
            <div className="col-span-2 bg-black/[0.02] border border-black/[0.04] rounded-lg p-2">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={cn(
                    "w-4 h-4 shrink-0",
                    safety.criticalCount > 0
                      ? "text-[var(--accent-red)]"
                      : safety.warningCount > 0
                        ? "text-[var(--accent-orange)]"
                        : "text-[var(--accent-green)]",
                  )}
                />
                <span className="text-[12px] text-[var(--text-heading)] flex-1">
                  {safety.total === 0
                    ? "No active alerts"
                    : `${safety.total} active alert${safety.total === 1 ? "" : "s"}`}
                </span>
                {safety.criticalCount > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[var(--accent-red)] px-1.5 py-0.5 rounded-full">
                    {safety.criticalCount}
                  </span>
                )}
                {safety.warningCount > 0 && safety.criticalCount === 0 && (
                  <span className="text-[10px] font-bold text-white bg-[var(--accent-orange)] px-1.5 py-0.5 rounded-full">
                    {safety.warningCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {weather && weatherAlert && weatherAlert.level !== "none" && (
            <div
              className={cn(
                "mx-2 mb-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium",
                weatherAlert.level === "critical"
                  ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                  : "bg-accent-orange/10 text-accent-orange border-accent-orange/20",
              )}
            >
              {weatherAlert.message}
            </div>
          )}

          <DropdownMenuSeparator className="bg-black/[0.06] my-1.5 mx-1" />

          {/* ── Communications ── */}
          <div className="px-2 pb-1">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
              Communications
            </p>
            <DropdownMenuItem
              className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-0 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
              onSelect={() => openWhatsAppWebWindow()}
            >
              <MessageCircle className="h-3.5 w-3.5 text-[var(--accent-green)]" />
              <span className="text-[13px] font-medium text-[var(--text-heading)]">
                WhatsApp Web
              </span>
              <span className="ml-auto text-[10px] text-[var(--text-muted)]">Window</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-0 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
              onSelect={() => openWhatsAppSplitView()}
            >
              <PanelRight className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span className="text-[13px] font-medium text-[var(--text-heading)]">
                WhatsApp Split View
              </span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="bg-black/[0.06] my-1.5 mx-1" />

          {/* ── View Submenu ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5 text-[13px] font-medium text-[var(--text-heading)]">
              <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span>View</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48 bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-xl py-1 z-[120]">
                <DropdownMenuItem
                  className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                  onSelect={() => window.location.reload()}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="text-[13px] font-medium text-[var(--text-heading)]">Reload</span>
                  <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘R</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                  onSelect={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    } else if (document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="text-[13px] font-medium text-[var(--text-heading)]">
                    Toggle Fullscreen
                  </span>
                  <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘F</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* ── Safety & Emergency (replaces Help) ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5 text-[13px] font-medium text-[var(--text-heading)]">
              <Siren className="h-3.5 w-3.5 text-[var(--accent-red)]" />
              <span>Safety &amp; Emergency</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-52 bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-xl py-1 z-[120]">
                <DropdownMenuItem
                  className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                  onSelect={() => {
                    window.location.href = "/safety/daily-log";
                  }}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="text-[13px] font-medium text-[var(--text-heading)]">
                    Daily Safety Log
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                  onSelect={() => {
                    window.location.href = "/safety";
                  }}
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="text-[13px] font-medium text-[var(--text-heading)]">
                    Safety Dashboard
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                <DropdownMenuItem
                  className="cursor-default hover:bg-accent-red/10 focus:bg-accent-red/10 rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                  onSelect={() => window.open("tel:+27170000000", "_self")}
                >
                  <Phone className="h-3.5 w-3.5 text-accent-red" />
                  <span className="text-[13px] font-medium text-accent-red">Emergency Line</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="bg-black/[0.06] my-1.5 mx-1" />

          {/* ── Power Options ── */}
          <DropdownMenuItem
            className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
            onSelect={() => setLocked(true)}
          >
            <Lock className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-heading)]">Lock Screen</span>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘Q</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
            onSelect={() => setSleeping(true)}
          >
            <Moon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-heading)]">Sleep</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-black/[0.06] my-1.5 mx-1" />

          <form action={logout}>
            <DropdownMenuItem
              asChild
              className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
            >
              <button type="submit" className="w-full flex items-center gap-2.5 px-2 py-1.5">
                <LogOut className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <span className="text-[13px] font-medium text-[var(--text-heading)]">Log Out</span>
                <span className="ml-auto text-[11px] text-[var(--text-muted)]">⇧⌘Q</span>
              </button>
            </DropdownMenuItem>
          </form>

          <DropdownMenuItem
            className="cursor-default hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
            onSelect={() => window.location.reload()}
          >
            <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-heading)]">Restart…</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-black/[0.06] my-1.5 mx-1" />

          <DropdownMenuItem
            className="cursor-default hover:bg-accent-red/10 focus:bg-accent-red/10 rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
            onSelect={() => setShutDown(true)}
          >
            <PowerOff className="h-3.5 w-3.5 text-accent-red" />
            <span className="text-[13px] font-medium text-accent-red">Shut Down…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Screen Lock Overlay ── */}
      {locked && (
        <div
          role="dialog"
          aria-label="Screen locked"
          className="fixed inset-0 z-[9999] backdrop-blur-xl bg-black/20 flex flex-col items-center justify-center gap-3 cursor-pointer"
          onClick={() => setLocked(false)}
        >
          <Lock className="w-8 h-8 text-white/60" />
          <span className="text-sm text-white/60 font-medium">Click anywhere to unlock</span>
        </div>
      )}

      {/* ── Sleep Overlay ── */}
      {sleeping && (
        <div
          role="dialog"
          aria-label="System sleeping"
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-3 cursor-pointer"
          onClick={() => setSleeping(false)}
        >
          <Moon className="w-8 h-8 text-white/40" />
          <span className="text-sm text-white/40 font-medium">Click anywhere to wake</span>
        </div>
      )}

      {/* ── Shut Down Overlay ── */}
      {shutDown && (
        <div
          role="dialog"
          aria-label="System shut down"
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-3"
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
          <span className="text-sm text-white/60 font-medium">
            It is now safe to turn off your computer.
          </span>
        </div>
      )}
    </>
  );
}
