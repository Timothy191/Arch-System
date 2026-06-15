"use client";

import React from "react";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { useSplitWindow } from "@/hooks/useSplitWindow";
import { cn } from "@repo/ui/lib/utils";
import {
  Clock,
  Wifi,
  WifiOff,
  LayoutDashboard,
  Map as MapIcon,
  Wrench,
  Bell,
  Settings,
  Command,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface ViewportBoundariesProps {
  className?: string;
}

const DOCK_APPS = [
  { name: "Hub", icon: LayoutDashboard, href: "/" },
  { name: "Drilling", icon: MapIcon, href: "/drilling" },
  { name: "Engineering", icon: Wrench, href: "/engineering" },
  { name: "Alerts", icon: Bell, href: "/safety" },
  { name: "Settings", icon: Settings, href: "/admin" },
];

/**
 * ViewportBoundaries
 *
 * Layout component that positions system status displays at the viewport edges
 * using pointer-events-none wrapper to prevent overlapping or blocking main workspace layouts.
 * Automatically shifts bottom right widgets to avoid overlapping persistent split-pane windows.
 */
export function ViewportBoundaries({ className }: ViewportBoundariesProps) {
  const { websocketLatency, serverTimeSAST, currentShift, online } =
    useSystemMetrics();
  const splitWindowOpen = useSplitWindow((s) => s.isOpen);
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-3 select-none",
        className,
      )}
    >
      {/* Top boundary space (Menu bar is at top-0 z-50, we leave this transparent) */}
      <div className="w-full flex justify-between pointer-events-none" />

      {/* Middle boundary space (Left and Right edges reserved for future tools/panels) */}
      <div className="flex-1 w-full flex justify-between items-center pointer-events-none">
        <div className="flex flex-col gap-2 items-start pointer-events-auto" />
        <div className="flex flex-col gap-2 items-end pointer-events-auto" />
      </div>

      {/* Bottom boundary container - Unified OS Dock */}
      <div className="w-full flex justify-center pb-2 pointer-events-none">
        <div
          data-testid="unified-dock"
          className={cn(
            "pointer-events-auto",
            "liquid-glass-light border border-white/40 shadow-window rounded-2xl px-3 py-2",
            "hidden md:flex items-center gap-4",
            "transition-all duration-300 ease-glass transform",
            splitWindowOpen
              ? "translate-y-0 sm:-translate-x-[200px]"
              : "translate-y-0 translate-x-0",
          )}
        >
          {/* 1. Anchor / Start Button */}
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Start Menu"
              className="group relative flex items-center gap-2 p-2 px-3 rounded-xl hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50"
            >
              <Command className="w-4 h-4 text-[var(--text-heading)] group-hover:scale-110 transition-transform duration-300 ease-glass" />
              <span className="text-xs font-medium text-[var(--text-heading)]">
                Start
              </span>
            </button>
          </div>

          <div className="h-6 w-px bg-black/[0.08]" />

          {/* 2. App Dock */}
          <div className="flex items-center gap-1.5">
            {DOCK_APPS.map((app) => {
              const isActive = pathname?.startsWith(app.href);
              const Icon = app.icon;
              return (
                <Link
                  key={app.name}
                  href={app.href}
                  className={cn(
                    "group relative flex items-center gap-2 p-2 px-3 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50",
                    isActive ? "bg-black/5" : "hover:bg-black/5",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform duration-300 ease-glass group-hover:scale-110 group-hover:-translate-y-0.5",
                      isActive
                        ? "text-[var(--accent-blue)]"
                        : "text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]",
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors duration-300",
                      isActive
                        ? "text-[var(--accent-blue)]"
                        : "text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]",
                    )}
                  >
                    {app.name}
                  </span>

                  {/* Active Indicator (macOS style dot) */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-blue)] shadow-[0_0_8px_var(--accent-blue)]" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="h-6 w-px bg-black/[0.08]" />

          {/* 3. System Tray */}
          <div className="flex items-center gap-3.5 px-2 text-xs">
            {/* Network Latency */}
            <div className="group relative flex items-center gap-1.5 cursor-default">
              {online ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className="text-[var(--text-secondary)] font-medium tabular-nums group-hover:text-[var(--text-heading)] transition-colors">
                {websocketLatency} ms
              </span>

              <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none transition-all duration-200 px-2.5 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap shadow-card">
                Network RTT
              </div>
            </div>

            {/* Current Shift */}
            <div className="group relative flex items-center gap-1.5 cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-heading)] transition-colors">
                {currentShift.label}
              </span>

              <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none transition-all duration-200 px-2.5 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap shadow-card">
                {currentShift.start} - {currentShift.end}
              </div>
            </div>

            {/* Time */}
            <div className="group relative flex items-center gap-1.5 text-[var(--text-heading)] font-semibold cursor-default">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              <span className="tabular-nums">{serverTimeSAST}</span>

              <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none transition-all duration-200 px-2.5 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap shadow-card origin-bottom-right">
                South Africa Standard Time
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
