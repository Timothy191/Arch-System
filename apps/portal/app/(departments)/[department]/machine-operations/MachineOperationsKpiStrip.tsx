'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, AlertTriangle, Clock, Gauge, Layers, TrendingUp } from 'lucide-react';
import { memo } from 'react';
import {
  buildSparklinePoints,
  GoldenTelemetrySparkline,
} from '@/components/telemetry/GoldenTelemetrySparkline';

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
  // Sparkline data points calculated from metrics
  const hoursPoints = buildSparklinePoints(Math.min(100, Math.round(totalHours * 1.5)), {
    hasSineWave: true,
  });
  const machinesPoints = buildSparklinePoints(Math.min(100, Math.round(activeMachines * 4)), {
    hasSineWave: true,
  });
  const materialPoints = buildSparklinePoints(Math.min(100, Math.round(totalMaterialBCM / 40)), {
    hasSineWave: true,
  });
  const bcmRatePoints = buildSparklinePoints(Math.min(100, Math.round(avgBcmPerHour / 2)), {
    hasSineWave: true,
  });
  const delaysPoints = buildSparklinePoints(Math.min(100, Math.round(totalDelayHours * 6)), {
    isInverted: true,
    hasSineWave: true,
  });

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
        <GoldenTelemetrySparkline
          id="today-hours"
          variant="kpi"
          points={hoursPoints}
          avgValue={`${(totalHours * 0.72).toFixed(1)}h`}
          peakValue={`${(totalHours * 1.05).toFixed(1)}h`}
          currentValue={`${totalHours.toFixed(1)}h`}
        />
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
        <GoldenTelemetrySparkline
          id="active-machines"
          variant="kpi"
          points={machinesPoints}
          avgValue={`${Math.max(1, Math.round(activeMachines * 0.8))}`}
          peakValue={`${Math.max(activeMachines, Math.round(activeMachines * 1.15))}`}
          currentValue={`${activeMachines}`}
          strokeColor="#10b981"
        />
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
        <GoldenTelemetrySparkline
          id="material-moved"
          variant="kpi"
          points={materialPoints}
          avgValue={`${(totalMaterialBCM * 0.65).toFixed(0)}`}
          peakValue={`${(totalMaterialBCM * 1.08).toFixed(0)}`}
          currentValue={`${totalMaterialBCM.toFixed(0)}`}
          strokeColor="#3b82f6"
        />
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
        <GoldenTelemetrySparkline
          id="bcm-rate"
          variant="kpi"
          points={bcmRatePoints}
          avgValue={`${(avgBcmPerHour * 0.85).toFixed(1)}`}
          peakValue={`${(avgBcmPerHour * 1.12).toFixed(1)}`}
          currentValue={`${avgBcmPerHour.toFixed(1)}`}
        />
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
        <GoldenTelemetrySparkline
          id="total-delays"
          variant="kpi"
          points={delaysPoints}
          avgValue={`${(totalDelayHours * 0.6).toFixed(1)}h`}
          peakValue={`${(totalDelayHours * 1.25).toFixed(1)}h`}
          currentValue={`${totalDelayHours.toFixed(1)}h`}
          strokeColor="#ef4444"
        />
      </GlassCard>
    </div>
  );
});
