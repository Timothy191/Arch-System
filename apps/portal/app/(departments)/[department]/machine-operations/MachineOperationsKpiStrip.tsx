'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Activity, AlertTriangle, Clock, Gauge, Layers, TrendingUp } from 'lucide-react';
import { memo } from 'react';

export interface MachineOperationsKpiStripProps {
  totalHours: number;
  activeMachines: number;
  totalMaterialBCM: number;
  avgBcmPerHour: number;
  totalDelayHours: number;
  controlRoomDelayHours?: number;
  totalEngineeringDelayHours?: number;
}

const KPI_SURFACE_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md';

const KPI_CARD_CLASS = cn(
  KPI_SURFACE_CLASS,
  'flex flex-col justify-between p-4 transition-[box-shadow,border-color] duration-200 ease-out hover:shadow-diffusion-md motion-reduce:transition-none'
);

const KPI_HEADER_LABEL_CLASS =
  'flex items-center gap-2 font-medium text-[13px] text-[var(--text-muted)] leading-[18px]';

const KPI_VALUE_BASE_CLASS = 'mt-1 font-semibold text-2xl tabular-nums';

const KPI_BADGE_BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium font-mono text-[13px] leading-[18px]';

const KPI_BADGE_TONES = {
  green: 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
  blue: 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  amber: 'border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]',
  red: 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
} as const;

export const MachineOperationsKpiStrip = memo(function MachineOperationsKpiStrip({
  totalHours,
  activeMachines,
  totalMaterialBCM,
  avgBcmPerHour,
  totalDelayHours,
  controlRoomDelayHours = 0,
  totalEngineeringDelayHours = 0,
}: MachineOperationsKpiStripProps) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      data-testid="machine-operations-kpi-strip"
    >
      {/* 1. Today's Hours */}
      <GlassCard className={KPI_CARD_CLASS}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Clock className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Today&apos;s Hours
            </p>
            <span className={cn(KPI_BADGE_BASE_CLASS, KPI_BADGE_TONES.green)}>
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Live
            </span>
          </div>
          <p className={cn(KPI_VALUE_BASE_CLASS, 'text-[var(--text-heading)]')}>
            {totalHours.toFixed(1)}h
          </p>
        </div>
      </GlassCard>

      {/* 2. Active Machines */}
      <GlassCard className={KPI_CARD_CLASS}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Activity className="h-3.5 w-3.5 text-[var(--accent-green)]" aria-hidden="true" />
              Active Machines
            </p>
            <span className={cn(KPI_BADGE_BASE_CLASS, KPI_BADGE_TONES.green)}>Fleet</span>
          </div>
          <p className={cn(KPI_VALUE_BASE_CLASS, 'text-[var(--accent-green)]')}>{activeMachines}</p>
        </div>
      </GlassCard>

      {/* 3. Material Moved */}
      <GlassCard className={KPI_CARD_CLASS}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Layers className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Material Moved
            </p>
            <span className={cn(KPI_BADGE_BASE_CLASS, KPI_BADGE_TONES.blue)}>BCM</span>
          </div>
          <p className={cn(KPI_VALUE_BASE_CLASS, 'text-[var(--accent-blue)]')}>
            {totalMaterialBCM.toFixed(1)} <span className="font-normal text-sm">BCM</span>
          </p>
        </div>
      </GlassCard>

      {/* 4. BCM/Hour */}
      <GlassCard className={KPI_CARD_CLASS}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Gauge className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              BCM/Hour
            </p>
            <span className={cn(KPI_BADGE_BASE_CLASS, KPI_BADGE_TONES.amber)}>Rate</span>
          </div>
          <p className={cn(KPI_VALUE_BASE_CLASS, 'text-[var(--accent-blue)]')}>
            {avgBcmPerHour.toFixed(1)}
          </p>
        </div>
      </GlassCard>

      {/* 5. Total Delays */}
      <GlassCard className={KPI_CARD_CLASS}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--accent-red)]" aria-hidden="true" />
              Total Delays
            </p>
            <span className={cn(KPI_BADGE_BASE_CLASS, KPI_BADGE_TONES.red)}>Shift</span>
          </div>
          <p className={cn(KPI_VALUE_BASE_CLASS, 'text-[var(--accent-red)]')}>
            {totalDelayHours.toFixed(1)}h
          </p>
          {totalEngineeringDelayHours > 0 && (
            <p className="mt-1.5 font-mono text-[13px] text-[var(--text-muted)] leading-[18px]">
              CR: {controlRoomDelayHours.toFixed(1)}h + Eng: {totalEngineeringDelayHours.toFixed(1)}
              h
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
});
