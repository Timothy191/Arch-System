'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Calendar, CircleDot, Drill, ExternalLink, MapPin, Ruler } from 'lucide-react';
import Link from 'next/link';
import { type ChangeEvent, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type DrillDailySavedRecord,
  type DrillingDailyLogPageData,
  type DrillingDailyLogSummary,
  type DrillRigDailyCardItem,
  type DrillShiftSnapshot,
  loadDrillingDailyLogData,
} from './actions';
import { DrillRigDailyCard } from './DrillRigDailyCard';

const UNASSIGNED_SITE_LABEL = 'Unassigned Site';
const DECIMAL_PRECISION = 2;
const METERS_DISPLAY_DECIMALS = 1;

const HEADER_CARD_CLASS = 'space-y-4 p-5';
const HEADER_TOP_CLASS = 'flex flex-wrap items-center justify-between gap-4';
const CONTROLS_CLASS = 'flex flex-wrap items-center gap-3';
const DATE_INPUT_CLASS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none';
const OPERATIONS_LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--accent-blue)] text-sm hover:bg-[var(--bg-card)]';
const KPI_GRID_CLASS = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4';
const KPI_CARD_CLASS = 'p-4';
const RIGS_GRID_CLASS = 'grid grid-cols-1 gap-5 lg:grid-cols-2';

export interface DrillingDailyLogClientProps {
  readonly departmentId: string;
  readonly today?: string;
  readonly initialData: DrillingDailyLogPageData;
}

function mergeWhereBlock(
  dayShift: DrillShiftSnapshot | null,
  nightShift: DrillShiftSnapshot | null
): string | null {
  const blocks = [dayShift?.blockDrilled ?? null, nightShift?.blockDrilled ?? null].filter(
    (block): block is string => Boolean(block)
  );
  const uniqueBlocks = Array.from(new Set(blocks));
  return uniqueBlocks.length > 0 ? uniqueBlocks.join(' / ') : null;
}

function recomputeSummary(rigs: readonly DrillRigDailyCardItem[]): DrillingDailyLogSummary {
  const activeSitesSet = new Set<string>();
  let loggedRigs = 0;
  let totalDailyMeters = 0;
  let totalDailyHoles = 0;

  for (const rig of rigs) {
    if (rig.isLogged) {
      loggedRigs += 1;
    }
    totalDailyMeters += rig.dailyMetersDrilled;
    totalDailyHoles += rig.dailyHolesDrilled;
    if (rig.whereSite !== UNASSIGNED_SITE_LABEL) {
      activeSitesSet.add(rig.whereSite);
    }
  }

  const activeSites = Array.from(activeSitesSet);
  return {
    activeRigs: rigs.length,
    loggedRigs,
    totalDailyMeters: Number(totalDailyMeters.toFixed(DECIMAL_PRECISION)),
    totalDailyHoles,
    activeSitesCount: activeSites.length,
    activeSites,
  };
}

function applySavedRecordToPageData(
  prevData: DrillingDailyLogPageData,
  savedRecord: DrillDailySavedRecord
): DrillingDailyLogPageData {
  const nextSnapshot: DrillShiftSnapshot = {
    id: savedRecord.id,
    shiftType: savedRecord.shiftType,
    metersDrilled: savedRecord.metersDrilled,
    holes: savedRecord.holes,
    site: savedRecord.site,
    blockDrilled: savedRecord.blockDrilled,
    operatorName: savedRecord.operatorName,
    comments: savedRecord.comments,
    status: savedRecord.status,
  };

  const nextRigs = prevData.rigs.map((rig) => {
    if (rig.machineId !== savedRecord.machineId) {
      return rig;
    }
    const dayShift = savedRecord.shiftType === 'day' ? nextSnapshot : rig.dayShift;
    const nightShift = savedRecord.shiftType === 'night' ? nextSnapshot : rig.nightShift;
    const dailyMetersDrilled = Number(
      ((dayShift?.metersDrilled ?? 0) + (nightShift?.metersDrilled ?? 0)).toFixed(DECIMAL_PRECISION)
    );
    const dailyHolesDrilled = (dayShift?.holes ?? 0) + (nightShift?.holes ?? 0);
    const whereSite =
      nightShift?.site ??
      dayShift?.site ??
      rig.homeSiteName ??
      rig.homeSiteCode ??
      UNASSIGNED_SITE_LABEL;
    const whereBlock = mergeWhereBlock(dayShift, nightShift);
    const whereDisplay = whereBlock ? `${whereSite} · ${whereBlock}` : whereSite;

    return {
      ...rig,
      dayShift,
      nightShift,
      dailyMetersDrilled,
      dailyHolesDrilled,
      whereSite,
      whereBlock,
      whereDisplay,
      isLogged: Boolean(dayShift || nightShift),
    };
  });

  return {
    ...prevData,
    rigs: nextRigs,
    summary: recomputeSummary(nextRigs),
  };
}

/**
 * Interactive Drilling Daily Log workspace displaying per-drill daily meters,
 * holes drilled, and location ("Where") cards with inline shift entry.
 */
export function DrillingDailyLogClient({
  departmentId,
  today,
  initialData,
}: DrillingDailyLogClientProps) {
  const [pageData, setPageData] = useState<DrillingDailyLogPageData>(initialData);
  const [selectedDate, setSelectedDate] = useState<string>(initialData.logDate || today || '');
  const [isPending, startTransition] = useTransition();

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDate = event.target.value;
    if (!nextDate) {
      return;
    }
    setSelectedDate(nextDate);
    startTransition(async () => {
      try {
        const refreshed = await loadDrillingDailyLogData({
          deptId: departmentId,
          logDate: nextDate,
        });
        setPageData(refreshed);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load drilling logs';
        toast.error(message);
      }
    });
  }

  function handleRigSaved(savedRecord: DrillDailySavedRecord) {
    setPageData((prevData) => applySavedRecordToPageData(prevData, savedRecord));
  }

  const { summary, rigs } = pageData;

  return (
    <div className="space-y-6">
      <GlassCard className={HEADER_CARD_CLASS}>
        <div className={HEADER_TOP_CLASS}>
          <div>
            <h2 className="font-semibold text-2xl text-[var(--text-heading)]">
              Drilling Daily Log
            </h2>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Per-drill daily meters, holes drilled, and active pit/bench location.
            </p>
          </div>

          <div className={CONTROLS_CLASS}>
            <label className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <Calendar className="h-4 w-4 text-[var(--accent-blue)]" />
              <span className="sr-only">Log date</span>
              <input
                type="date"
                aria-label="Log date"
                value={selectedDate}
                onChange={handleDateChange}
                disabled={isPending}
                className={DATE_INPUT_CLASS}
              />
            </label>

            <Link href="/drilling/drilling-operations" className={OPERATIONS_LINK_CLASS}>
              <span>Drilling Operations</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </GlassCard>

      <div className={KPI_GRID_CLASS}>
        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
            <Drill className="h-4 w-4 text-[var(--accent-blue)]" />
            <span>Active Rigs</span>
          </div>
          <p className="mt-2 font-semibold text-2xl text-[var(--text-heading)]">
            {summary.activeRigs}
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            {summary.loggedRigs} of {summary.activeRigs} logged
          </p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
            <Ruler className="h-4 w-4 text-[var(--accent-cyan)]" />
            <span>Total Daily Meters Drilled (m)</span>
          </div>
          <p className="mt-2 font-semibold text-2xl text-[var(--text-heading)]">
            {summary.totalDailyMeters.toFixed(METERS_DISPLAY_DECIMALS)} m
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">Day + Night shift total</p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
            <CircleDot className="h-4 w-4 text-emerald-600" />
            <span>Total Daily Holes</span>
          </div>
          <p className="mt-2 font-semibold text-2xl text-[var(--text-heading)]">
            {summary.totalDailyHoles}
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">Across all active rigs</p>
        </GlassCard>

        <GlassCard className={KPI_CARD_CLASS}>
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span>Sites Active</span>
          </div>
          <p className="mt-2 font-semibold text-2xl text-[var(--text-heading)]">
            {summary.activeSitesCount}
          </p>
          <p className="mt-0.5 truncate text-[var(--text-muted)] text-xs">
            {summary.activeSites.length > 0 ? summary.activeSites.join(', ') : 'No sites assigned'}
          </p>
        </GlassCard>
      </div>

      {isPending && (
        <p className="text-[var(--text-muted)] text-sm" role="status">
          Loading drilling logs for {selectedDate}...
        </p>
      )}

      {rigs.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="font-medium text-[var(--text-heading)] text-sm">
            No active drill rigs found.
          </p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            Register active Drill Rig assets in Fleet Administration to log daily meters.
          </p>
        </GlassCard>
      ) : (
        <div className={RIGS_GRID_CLASS}>
          {rigs.map((rig) => (
            <DrillRigDailyCard
              key={rig.machineId}
              departmentId={departmentId}
              logDate={pageData.logDate}
              rig={rig}
              onSaved={handleRigSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
