"use client";

import { cn } from "@repo/ui/lib/utils";
import {
  Bell,
  Clock,
  Command,
  LayoutDashboard,
  Map as MapIcon,
  Pin,
  PinOff,
  Settings,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDockPreferences } from "@/hooks/useDockPreferences";
import { useSplitWindow } from "@/hooks/useSplitWindow";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";

interface ViewportBoundariesProps {
  className?: string;
}

const DOCK_APPS = [
  { name: "Hub", icon: LayoutDashboard, href: "/" },
  { name: "Drilling", icon: MapIcon, href: "/drilling" },
  { name: "Engineering", icon: Wrench, href: "/engineering" },
  { name: "Alerts", icon: Bell, href: "/control-room" },
  { name: "Settings", icon: Settings, href: "/admin" },
];

/**
 * ViewportBoundaries
 *
 * Layout component that positions system status displays at the viewport edges
 * using pointer-events-none wrapper to prevent overlapping or blocking main workspace layouts.
 * Automatically shifts bottom right widgets to avoid overlapping persistent split-pane windows.
 * Features an auto-hide dock with hover sensor, focus preservation, and pin/unpin controls.
 */
export function ViewportBoundaries({ className }: ViewportBoundariesProps) {
  const { websocketLatency, serverTimeSAST, currentShift, online } = useSystemMetrics();
  const splitWindowOpen = useSplitWindow((s) => s.isOpen);
  const { autoHide, toggleAutoHide } = useDockPreferences();
  const pathname = usePathname();

  // AGENT-TRACE: Local visibility state with grace-period debounce to avoid sudden dock flickering
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearLeaveTimer();
    setIsHovered(true);
  }, [clearLeaveTimer]);

  const handleMouseLeave = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 400);
  }, [clearLeaveTimer]);

  const handleFocusCapture = useCallback(() => {
    clearLeaveTimer();
    setIsFocused(true);
  }, [clearLeaveTimer]);

  const handleBlurCapture = useCallback((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  }, []);

  // AGENT-TRACE: Listen to mousemove near bottom edge of screen to reveal dock smoothly
  useEffect(() => {
    if (!autoHide) return;

    const handleMouseMove = (e: MouseEvent) => {
      const threshold = 36;
      if (window.innerHeight - e.clientY <= threshold) {
        clearLeaveTimer();
        setIsHovered(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [autoHide, clearLeaveTimer]);

  useEffect(() => {
    return () => {
      clearLeaveTimer();
    };
  }, [clearLeaveTimer]);

  const isRevealed = !autoHide || isHovered || isFocused;

  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-3 select-none",
        className
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
      <div
        className="w-full flex flex-col items-center justify-end pb-2 pointer-events-none relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Hot-edge trigger zone for revealing dock when auto-hidden */}
        {autoHide && (
          <div
            data-testid="dock-trigger-zone"
            className="fixed bottom-0 left-0 right-0 h-4 pointer-events-auto z-30"
            onMouseEnter={handleMouseEnter}
          />
        )}

        {/* Peek indicator when dock is auto-hidden */}
        {autoHide && (
          <div
            data-testid="dock-peek-indicator"
            onClick={handleMouseEnter}
            onMouseEnter={handleMouseEnter}
            aria-label="Reveal dock"
            className={cn(
              "fixed bottom-1.5 pointer-events-auto cursor-pointer transition-all duration-300 ease-glass",
              "w-12 h-1 rounded-full bg-black/20 hover:bg-black/40 shadow-sm border border-black/5",
              isRevealed
                ? "opacity-0 pointer-events-none translate-y-2"
                : "opacity-100 translate-y-0"
            )}
          />
        )}

        <div
          data-testid="unified-dock"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocusCapture={handleFocusCapture}
          onBlurCapture={handleBlurCapture}
          onContextMenu={(e) => {
            e.preventDefault();
            toggleAutoHide();
          }}
          className={cn(
            "liquid-glass-light border border-white/20 shadow-window rounded-2xl px-3 py-2",
            "hidden md:flex items-center gap-4",
            "transition-all duration-300 ease-glass transform",
            isRevealed
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "translate-y-[calc(100%+1.5rem)] opacity-0 pointer-events-none",
            splitWindowOpen ? "sm:-translate-x-[200px]" : "translate-x-0"
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
              <span className="text-xs font-medium text-[var(--text-heading)]">Start</span>
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
                    isActive ? "bg-black/5" : "hover:bg-black/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform duration-300 ease-glass group-hover:scale-110 group-hover:-translate-y-0.5",
                      isActive
                        ? "text-[var(--accent-blue)]"
                        : "text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors duration-300",
                      isActive
                        ? "text-[var(--accent-blue)]"
                        : "text-[var(--text-secondary)] group-hover:text-[var(--text-heading)]"
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
              <span className="tabular-nums" suppressHydrationWarning>
                {serverTimeSAST}
              </span>

              <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none transition-all duration-200 px-2.5 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap shadow-card origin-bottom-right">
                South Africa Standard Time
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-black/[0.08]" />

          {/* 4. Dock Controls (Auto-hide / Pin Toggle) */}
          <div className="flex items-center">
            <button
              type="button"
              data-testid="dock-autohide-toggle"
              onClick={toggleAutoHide}
              aria-label={autoHide ? "Pin dock (disable auto-hide)" : "Auto-hide dock"}
              aria-pressed={!autoHide}
              title={autoHide ? "Pin Dock (Keep visible)" : "Auto-Hide Dock"}
              className="group relative flex items-center p-1.5 rounded-xl hover:bg-black/5 text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50"
            >
              {autoHide ? (
                <PinOff className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" />
              ) : (
                <Pin className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200 text-[var(--accent-blue)]" />
              )}
              <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none transition-all duration-200 px-2.5 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap shadow-card">
                {autoHide ? "Pin Dock" : "Auto-Hide Dock"}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
