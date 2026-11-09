'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { Activity, Layers, Truck } from 'lucide-react';
import { memo } from 'react';
import {
  buildSparklinePoints,
  GoldenTelemetrySparkline,
} from '@/components/telemetry/GoldenTelemetrySparkline';

export interface ExcavatorActivityTelemetryOverviewProps {
  readonly totalBcm: number;
  readonly totalLoads: number;
  readonly activeExcavators: number;
  readonly fleetExcavatorsCount: number;
  readonly wasteLoads: number;
  readonly coalLoads: number;
  readonly plantUnitsCount: number;
  readonly otherUnitsCount: number;
  readonly targetBcm?: number;
  readonly targetLoads?: number;
}

const GOLDEN_SEPARATOR_CLASS =
  'h-px w-full bg-gradient-to-r from-accent-amber/65 via-slate-200 to-transparent';

const GOLDEN_LABEL_PILL_CLASS =
  'system-label gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-accent-amber/40 bg-white/85 px-2.5 py-0.5 shadow-2xs';

const TALLY_PILL_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-accent-amber/35 bg-white/85 px-2.5 py-1 font-mono font-semibold text-[11px] text-[var(--text-heading)] tabular-nums shadow-2xs';

const DEFAULT_SHIFT_BCM_TARGET = 5400;
const DEFAULT_SHIFT_LOADS_TARGET = 180;

function ExcavatorActivityTelemetryOverviewBase({
  totalBcm,
  totalLoads,
  activeExcavators,
  fleetExcavatorsCount,
  wasteLoads,
  coalLoads,
  plantUnitsCount,
  otherUnitsCount,
  targetBcm = DEFAULT_SHIFT_BCM_TARGET,
  targetLoads = DEFAULT_SHIFT_LOADS_TARGET,
}: ExcavatorActivityTelemetryOverviewProps) {
  const safeTargetBcm = Math.max(targetBcm, 1);
  const safeTargetLoads = Math.max(targetLoads, 1);
  const safeFleetCount = Math.max(fleetExcavatorsCount, 1);

  const bcmAttainmentPct = Math.min(100, Math.round((totalBcm / safeTargetBcm) * 1000) / 10);
  const loadsAttainmentPct = Math.min(100, Math.round((totalLoads / safeTargetLoads) * 1000) / 10);
  const activeFleetPct = Math.min(100, Math.round((activeExcavators / safeFleetCount) * 1000) / 10);

  const avgBcmPerExcavator =
    activeExcavators > 0 ? totalBcm / activeExcavators : totalBcm / safeFleetCount;
  const avgLoadsPerExcavator =
    activeExcavators > 0 ? totalLoads / activeExcavators : totalLoads / safeFleetCount;

  return (
    <div className="space-y-6">
      {/* Item 5: Full-window extended header panel with Golden Separator & Global Combined Tally */}
      <div
        className="flex w-full items-center justify-between"
        data-testid="excavator-activity-header-row"
      >
        <div className="gold-steel-border gold-steel-border-slim w-full rounded-xl bg-white/80 px-4 py-3 shadow-2xs backdrop-blur-md">
          <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2.5">
              <Logo variant="gold" className="h-5 w-5 shrink-0" />
              <h2 className="font-medium text-[var(--text-heading)] text-fluid-2xl">
                Excavator Activity
              </h2>
            </div>

            {/* Global Combined Tally Strip */}
            <div
              className="flex flex-wrap items-center gap-2"
              data-testid="excavator-global-combined-tally"
              aria-label="Global Combined Excavator Tally"
            >
              <span className="font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Global Combined Tally:
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Layers className="h-3 w-3 text-accent-green" />
                {totalBcm.toFixed(1)} BCM ({bcmAttainmentPct.toFixed(1)}%)
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Truck className="h-3 w-3 text-[var(--accent-blue)]" />
                {totalLoads.toLocaleString()} Loads (W: {wasteLoads} · C: {coalLoads})
              </span>
              <span className={TALLY_PILL_CLASS}>
                <Activity className="h-3 w-3 text-accent-amber" />
                {activeExcavators}/{fleetExcavatorsCount} Active ({activeFleetPct.toFixed(0)}%)
                {(plantUnitsCount > 0 || otherUnitsCount > 0) &&
                  ` · Plant: ${plantUnitsCount} · Other: ${otherUnitsCount}`}
              </span>
            </div>
          </div>

          <div
            data-testid="excavator-header-golden-separator"
            aria-hidden="true"
            className={`mt-2.5 ${GOLDEN_SEPARATOR_CLASS}`}
          />
        </div>
      </div>

      {/* Items 6-11: 3 Redesigned KPI Cards with Golden Bordering on Labels, % Badges, Separators & Golden Graphs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Total BCM */}
        <GlassCard hover accent="green" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Total BCM</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-accent-green">{totalBcm.toFixed(1)}</p>
                  <span
                    data-testid="total-bcm-pct-badge"
                    className="rounded-full border border-accent-green/30 bg-accent-green/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-accent-green tabular-nums"
                  >
                    {bcmAttainmentPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-total-bcm"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <GoldenTelemetrySparkline
            id="total-bcm"
            variant="excavator"
            title="Volume Moved Curve"
            badgeLabel={`${bcmAttainmentPct.toFixed(1)}% target`}
            currentValue={`${totalBcm.toFixed(1)} BCM`}
            avgValue={`${avgBcmPerExcavator.toFixed(1)}/ex`}
            peakValue={`${safeTargetBcm.toLocaleString()} BCM`}
            points={buildSparklinePoints(Math.max(bcmAttainmentPct, 32))}
          />
        </GlassCard>

        {/* Card 2: Total Loads */}
        <GlassCard hover accent="blue" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Total Loads</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-accent-green">
                    {totalLoads.toLocaleString()}
                  </p>
                  <span
                    data-testid="total-loads-pct-badge"
                    className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-[var(--accent-blue)] tabular-nums"
                  >
                    {loadsAttainmentPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-total-loads"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <GoldenTelemetrySparkline
            id="total-loads"
            variant="excavator"
            title="Haulage Loads Velocity"
            badgeLabel={`${loadsAttainmentPct.toFixed(1)}% target`}
            currentValue={`${totalLoads.toLocaleString()} ld`}
            avgValue={`${avgLoadsPerExcavator.toFixed(1)}/ex`}
            peakValue={`${safeTargetLoads} ld`}
            points={buildSparklinePoints(Math.max(loadsAttainmentPct, 35))}
          />
        </GlassCard>

        {/* Card 3: Active Excavators */}
        <GlassCard hover accent="cyan" className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={GOLDEN_LABEL_PILL_CLASS}>Active Excavators</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="mt-1 font-bold text-2xl text-[var(--accent-green)]">
                    {activeExcavators}
                  </p>
                  <span
                    data-testid="active-excavators-pct-badge"
                    className="rounded-full border border-accent-amber/40 bg-accent-amber/12 px-2 py-0.5 font-mono font-semibold text-[11px] text-[var(--text-heading)] tabular-nums"
                  >
                    {activeFleetPct.toFixed(1)}% ({activeExcavators}/{fleetExcavatorsCount})
                  </span>
                </div>
              </div>
            </div>
            <div
              data-testid="excavator-kpi-separator-active-excavators"
              aria-hidden="true"
              className={`mt-2 ${GOLDEN_SEPARATOR_CLASS}`}
            />
          </div>
          <GoldenTelemetrySparkline
            id="active-excavators"
            variant="excavator"
            title="Fleet Deployment Rate"
            badgeLabel={`${activeFleetPct.toFixed(1)}% active`}
            currentValue={`${activeExcavators} active`}
            avgValue={`${plantUnitsCount + otherUnitsCount} aux`}
            peakValue={`${fleetExcavatorsCount} fleet`}
            points={buildSparklinePoints(Math.max(activeFleetPct, 38))}
          />
        </GlassCard>
      </div>
    </div>
  );
}

export const ExcavatorActivityTelemetryOverview = memo(ExcavatorActivityTelemetryOverviewBase);
