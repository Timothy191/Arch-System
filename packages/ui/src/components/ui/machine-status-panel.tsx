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
        className={cn('p-5 flex flex-col gap-4', className)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[var(--accent-blue)] px-2 py-0.5 rounded bg-[var(--accent-blue)]/10">
                {machineId}
              </span>
              <h4 className="font-semibold text-sm text-[var(--text-heading)] truncate">{name}</h4>
            </div>
            {model && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{model}</p>}
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Primary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-black/[0.06]">
          {uptimePct !== undefined && (
            <div className="p-2 rounded-lg bg-black/[0.02] border border-black/[0.04]">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
                <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Uptime</span>
              </div>
              <span className="font-mono font-bold text-sm text-[var(--text-heading)]">
                {uptimePct}%
              </span>
            </div>
          )}

          {hoursRun !== undefined && (
            <div className="p-2 rounded-lg bg-black/[0.02] border border-black/[0.04]">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hours</span>
              </div>
              <span className="font-mono font-bold text-sm text-[var(--text-heading)]">
                {hoursRun.toLocaleString()}h
              </span>
            </div>
          )}

          {operator && (
            <div className="p-2 rounded-lg bg-black/[0.02] border border-black/[0.04] col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Operator</span>
              </div>
              <span className="font-medium text-xs text-[var(--text-heading)] truncate block">
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
                className="flex items-center justify-between p-2 rounded-lg bg-black/[0.015] border border-black/[0.04]"
              >
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  {t.icon ?? <Activity className="w-3.5 h-3.5" aria-hidden="true" />}
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
          <div className="text-[10px] text-[var(--text-secondary)] flex items-center justify-between pt-2 border-t border-black/[0.04]">
            <span>Last Telemetry Ping:</span>
            <span className="font-mono">{lastPing}</span>
          </div>
        )}
      </GlassCard>
    );
  }
);
MachineStatusPanel.displayName = 'MachineStatusPanel';
