'use client';

import { AlertTriangle, Battery, BatteryCharging, Bell, BellOff, Wifi } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export interface HeaderDiagnosticsProps {
  className?: string;
  latencyMs?: number;
  criticalAlertsCount?: number;
  alertsHref?: string;
}

export function HeaderDiagnostics({
  className,
  latencyMs = 18,
  criticalAlertsCount = 2,
  alertsHref = '/alerts',
}: HeaderDiagnosticsProps) {
  const [alarmsActive, setAlarmsActive] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(94);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> })
        .getBattery()
        .then((b) => {
          setBatteryLevel(Math.round(b.level * 100));
          setIsCharging(b.charging);
        })
        .catch(() => {});
    }
  }, []);

  const isDegraded = latencyMs >= 50;

  return (
    <div className={cn('flex items-center gap-2 shrink-0', className)}>
      {/* ── Status Capsule ── */}
      <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs shadow-sm">
        {/* Heartbeat pulse */}
        <div
          className="flex items-center gap-1.5 cursor-help"
          title={`MQTT Bus: ${isDegraded ? 'Degraded' : 'Synced'} (${latencyMs}ms)`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                isDegraded ? 'bg-amber-400' : 'bg-emerald-400'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                isDegraded ? 'bg-amber-500' : 'bg-emerald-500'
              )}
            />
          </span>
          <span
            className={cn(
              'font-mono tabular-nums text-[11px] font-medium hidden lg:inline',
              isDegraded
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {latencyMs}ms
          </span>
        </div>

        <div className="h-3.5 w-[1px] bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

        {/* Audio / Alarm Bell Toggle */}
        <button
          type="button"
          onClick={() => setAlarmsActive((prev) => !prev)}
          className={cn(
            'flex items-center gap-1 transition-colors rounded p-0.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 focus:outline-none',
            alarmsActive
              ? 'text-slate-700 dark:text-slate-300'
              : 'text-slate-400 dark:text-slate-500'
          )}
          title={
            alarmsActive
              ? 'Alarms Active · Click to silence sirens'
              : 'Sirens Muted · Click to reactivate'
          }
        >
          {alarmsActive ? (
            <Bell className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <BellOff className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        <div className="h-3.5 w-[1px] bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

        {/* Wi-Fi Indicator */}
        <div
          className="flex items-center text-slate-600 dark:text-slate-400"
          title="SCADA Wi-Fi: Strong (5 GHz)"
        >
          <Wifi className="w-3.5 h-3.5" />
        </div>

        {/* Battery Telemetry in strict tabular numbers */}
        <div
          className="flex items-center gap-1 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300"
          title={`Battery: ${batteryLevel}%`}
        >
          {isCharging ? (
            <BatteryCharging className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Battery className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="text-[11px] font-medium">{batteryLevel}%</span>
        </div>
      </div>

      {/* ── Critical Fault / Alert Indicator ── */}
      {criticalAlertsCount > 0 && (
        <Link
          href={alertsHref}
          className="bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 shrink-0"
          title="Active Breakdown Logs & Critical Alerts"
        >
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 animate-pulse" />
          <span>{criticalAlertsCount} Critical</span>
        </Link>
      )}
    </div>
  );
}
