'use client';

import { GlassCard } from '@repo/ui/GlassCard';
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

const KPI_HEADER_LABEL_CLASS =
  'flex items-center gap-1.5 font-medium text-[13px] text-[var(--text-muted)] leading-[18px]';

const KPI_BADGE_GREEN_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-green leading-[18px]';

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
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Clock className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Today&apos;s Hours
            </p>
            <span className={KPI_BADGE_GREEN_CLASS}>
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Live
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
            {totalHours.toFixed(1)}h
          </p>
        </div>
      </GlassCard>

      {/* 2. Active Machines */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Activity className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" />
              Active Machines
            </p>
            <span className={KPI_BADGE_GREEN_CLASS}>Fleet</span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-green tabular-nums">
            {activeMachines}
          </p>
        </div>
      </GlassCard>

      {/* 3. Material Moved */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Layers className="h-3.5 w-3.5 text-[var(--accent-blue)]" aria-hidden="true" />
              Material Moved
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium font-mono text-[13px] text-[var(--accent-blue)] leading-[18px]">
              BCM
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-[var(--accent-blue)] tabular-nums">
            {totalMaterialBCM.toFixed(1)} <span className="font-normal text-sm">BCM</span>
          </p>
        </div>
      </GlassCard>

      {/* 4. BCM/Hour */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <Gauge className="h-3.5 w-3.5 text-accent-blue" aria-hidden="true" />
              BCM/Hour
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-amber leading-[18px]">
              Rate
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-blue tabular-nums">
            {avgBcmPerHour.toFixed(1)}
          </p>
        </div>
      </GlassCard>

      {/* 5. Total Delays */}
      <GlassCard className="flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className={KPI_HEADER_LABEL_CLASS}>
              <AlertTriangle className="h-3.5 w-3.5 text-accent-red" aria-hidden="true" />
              Total Delays
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-red/30 bg-accent-red/10 px-2 py-0.5 font-medium font-mono text-[13px] text-accent-red leading-[18px]">
              Shift
            </span>
          </div>
          <p className="mt-1 font-semibold text-2xl text-accent-red tabular-nums">
            {totalDelayHours.toFixed(1)}h
          </p>
          {totalEngineeringDelayHours > 0 && (
            <p className="mt-0.5 font-mono text-[13px] text-[var(--text-muted)] leading-[18px]">
              CR: {controlRoomDelayHours.toFixed(1)}h + Eng: {totalEngineeringDelayHours.toFixed(1)}
              h
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
});
