import { Activity, Clock, Cpu, Gauge } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../GlassCard';
import { type MachineOperationalStatus, StatusBadge } from './status-badge';

export interface MachineTelemetryItem {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
}

export interface MachineStatusPanelProps {
  machineId: string;
  name: string;
  model?: string;
  status: MachineOperationalStatus;
  operator?: string;
  uptimePct?: number;
  hoursRun?: number;
  telemetry?: MachineTelemetryItem[];
  lastPing?: string;
  className?: string;
  onClick?: () => void;
}

export const MachineStatusPanel = React.forwardRef<HTMLDivElement, MachineStatusPanelProps>(
  (
    {
      className,
      machineId,
      name,
      model,
      status,
      operator,
      uptimePct,
      hoursRun,
      telemetry = [],
      lastPing,
      onClick,
    },
    ref
  ) => {
    return (
      <GlassCard
        ref={ref}
        variant="window"
        onClick={onClick}
        className={cn('flex flex-col gap-4 p-5', className)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--accent-blue)]/10 px-2 py-0.5 font-mono font-semibold text-[var(--accent-blue)] text-xs">
                {machineId}
              </span>
              <h4 className="truncate font-semibold text-[var(--text-heading)] text-sm">{name}</h4>
            </div>
            {model && <p className="mt-0.5 text-[var(--text-secondary)] text-xs">{model}</p>}
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Primary Metrics Row */}
        <div className="grid grid-cols-2 gap-2.5 border-black/[0.06] border-t pt-2 sm:grid-cols-3">
          {uptimePct !== undefined && (
            <div className="rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)] text-xs">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Uptime</span>
              </div>
              <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                {uptimePct}%
              </span>
            </div>
          )}

          {hoursRun !== undefined && (
            <div className="rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)] text-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hours</span>
              </div>
              <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                {hoursRun.toLocaleString()}h
              </span>
            </div>
          )}

          {operator && (
            <div className="col-span-2 rounded-lg border border-black/[0.04] bg-black/[0.02] p-2 sm:col-span-1">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)] text-xs">
                <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Operator</span>
              </div>
              <span className="block truncate font-medium text-[var(--text-heading)] text-xs">
                {operator}
              </span>
            </div>
          )}
        </div>

        {/* Live Telemetry items */}
        {telemetry.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {telemetry.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-black/[0.015] p-2"
              >
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  {t.icon ?? <Activity className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{t.label}</span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-heading)]">
                  {t.value} {t.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer timestamp */}
        {lastPing && (
          <div className="flex items-center justify-between border-black/[0.04] border-t pt-2 text-[10px] text-[var(--text-secondary)]">
            <span>Last Telemetry Ping:</span>
            <span className="font-mono">{lastPing}</span>
          </div>
        )}
      </GlassCard>
    );
  }
);
MachineStatusPanel.displayName = 'MachineStatusPanel';
