'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import type { GlobePin } from '@repo/ui/components/GlobePins';
import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

// AGENT-TRACE: ControlRoomGlobePanel renders the interactive 3D operations globe
// with data bubbles derived from REAL machines, breakdowns, and hourly loads.
// GlobePins (WebGL) is lazy-loaded with ssr:false to keep the RSC payload small.

const GlobePins = dynamic(
  () => import('@repo/ui/components/GlobePins').then((mod) => mod.GlobePins),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[420px] w-full animate-pulse rounded-card bg-[var(--bg-tertiary)]"
        data-testid="operations-3d-globe-skeleton"
      />
    ),
  }
);

const MS_PER_HOUR = 3_600_000;
const MAX_BREAKDOWNS = 200;
const DELMAS_FALLBACK_LAT = -26.15;
const DELMAS_FALLBACK_LON = 28.68;

const PANEL_CLASS = 'overflow-hidden';
const GLOBE_STAGE_CLASS = 'relative h-[420px] w-full';
const EMPTY_STATE_CLASS =
  'flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-card border border-[var(--border-default)] bg-[var(--bg-secondary)] text-center';

interface GlobeMachineRow {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly site?: { readonly name?: string | null; readonly site_code?: string | null } | null;
}

interface GlobeBreakdownRow {
  readonly id: string;
  readonly machine_id: string | null;
  readonly machine_name: string | null;
  readonly status: string | null;
  readonly date_in: string | null;
  readonly time_in: string | null;
  readonly date_out: string | null;
  readonly time_out: string | null;
  readonly created_at: string | null;
}

interface GlobeLoadRow {
  readonly machine_id: string | null;
  readonly total_loads: number | null;
}

export interface ControlRoomGlobePanelProps {
  readonly departmentId: string;
  readonly pins?: readonly GlobePin[];
}

interface MachineAggregate {
  readonly machineId: string;
  readonly machineName: string;
  readonly siteCode: string | null;
  readonly isActive: boolean;
  readonly loads: number;
  readonly latestBreakdown: GlobeBreakdownRow | null;
}

function parseFiniteNumber(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function breakdownTimestampMs(breakdown: GlobeBreakdownRow): number {
  if (!breakdown.date_in) return 0;
  const suffix = breakdown.time_in ? `T${breakdown.time_in}` : 'T00:00';
  const parsed = Date.parse(`${breakdown.date_in}${suffix}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeDelayHours(breakdown: GlobeBreakdownRow | null): number {
  if (!breakdown?.date_in) return 0;
  const startMs = breakdownTimestampMs(breakdown);
  if (startMs <= 0) return 0;
  const endMs =
    breakdown.date_out && breakdown.time_out
      ? Date.parse(`${breakdown.date_out}T${breakdown.time_out}`)
      : Date.now();
  const resolvedEndMs = Number.isFinite(endMs) && endMs > startMs ? endMs : startMs;
  return Math.max(0, (resolvedEndMs - startMs) / MS_PER_HOUR);
}

function resolveStatus(aggregate: MachineAggregate): 'online' | 'standby' | 'alert' {
  if (aggregate.latestBreakdown?.status === 'active') return 'alert';
  return aggregate.isActive ? 'online' : 'standby';
}

function buildTelemetrySummary(aggregate: MachineAggregate): string {
  const loadsLabel = `${aggregate.loads} ${aggregate.loads === 1 ? 'load' : 'loads'}`;
  const delayHours = computeDelayHours(aggregate.latestBreakdown);
  const delayLabel = `${delayHours.toFixed(1)}h delay`;
  const statusLabel = resolveStatus(aggregate);
  return `${loadsLabel} · ${delayLabel} · ${statusLabel}`;
}

function aggregateMachines(
  machines: readonly GlobeMachineRow[],
  breakdowns: readonly GlobeBreakdownRow[],
  loads: readonly GlobeLoadRow[]
): MachineAggregate[] {
  const loadsByMachine = new Map<string, number>();
  for (const load of loads) {
    if (!load.machine_id) continue;
    loadsByMachine.set(
      load.machine_id,
      (loadsByMachine.get(load.machine_id) ?? 0) + parseFiniteNumber(load.total_loads)
    );
  }

  const latestBreakdownByMachine = new Map<string, GlobeBreakdownRow>();
  for (const breakdown of breakdowns) {
    if (!breakdown.machine_id) continue;
    const existing = latestBreakdownByMachine.get(breakdown.machine_id);
    if (!existing || breakdownTimestampMs(breakdown) > breakdownTimestampMs(existing)) {
      latestBreakdownByMachine.set(breakdown.machine_id, breakdown);
    }
  }

  return machines.map((machine) => ({
    machineId: machine.id,
    machineName: machine.name,
    siteCode: machine.site?.site_code ?? null,
    isActive: machine.active,
    loads: loadsByMachine.get(machine.id) ?? 0,
    latestBreakdown: latestBreakdownByMachine.get(machine.id) ?? null,
  }));
}

function toGlobePin(aggregate: MachineAggregate): GlobePin {
  const status = resolveStatus(aggregate);
  return {
    id: aggregate.machineId,
    label: aggregate.machineName,
    lat: DELMAS_FALLBACK_LAT,
    lon: DELMAS_FALLBACK_LON,
    siteCode: aggregate.siteCode ?? undefined,
    status,
    telemetrySummary: buildTelemetrySummary(aggregate),
  };
}

/** Most recent update (latest breakdown/alert) floats to the front of the pin list. */
function prioritizePins(pins: readonly GlobePin[]): GlobePin[] {
  return [...pins].sort((left, right) => {
    const leftRank = left.status === 'alert' ? 0 : left.status === 'online' ? 1 : 2;
    const rightRank = right.status === 'alert' ? 0 : right.status === 'online' ? 1 : 2;
    return leftRank - rightRank;
  });
}

export function ControlRoomGlobePanel({ departmentId, pins }: ControlRoomGlobePanelProps) {
  const [machines, setMachines] = useState<readonly GlobeMachineRow[]>([]);
  const [breakdowns, setBreakdowns] = useState<readonly GlobeBreakdownRow[]>([]);
  const [loads, setLoads] = useState<readonly GlobeLoadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOperationalData = useCallback(async () => {
    const client = (() => {
      try {
        return createBrowserSupabaseClient();
      } catch {
        return null;
      }
    })();
    if (!client) {
      setIsLoading(false);
      return;
    }

    try {
      const [machinesRes, breakdownsRes, loadsRes] = await Promise.all([
        client
          .from('machines')
          .select('id, name, active, site:sites(name, site_code)')
          .eq('active', true)
          .order('name'),
        client
          .from('breakdowns')
          .select(
            'id, machine_id, machine_name, status, date_in, time_in, date_out, time_out, created_at'
          )
          .eq('department_id', departmentId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(MAX_BREAKDOWNS),
        client
          .from('hourly_loads')
          .select('machine_id, total_loads')
          .eq('department_id', departmentId),
      ]);

      setMachines((machinesRes.data ?? []) as GlobeMachineRow[]);
      setBreakdowns((breakdownsRes.data ?? []) as GlobeBreakdownRow[]);
      setLoads((loadsRes.data ?? []) as GlobeLoadRow[]);
    } catch {
      // Keep empty-state when Supabase is unreachable; never fabricate pins.
    } finally {
      setIsLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);

  const derivedPins = useMemo<readonly GlobePin[]>(() => {
    if (pins) return pins;
    const aggregates = aggregateMachines(machines, breakdowns, loads);
    return prioritizePins(aggregates.map(toGlobePin));
  }, [pins, machines, breakdowns, loads]);

  const hasPins = derivedPins.length > 0;
  return (
    <GlassCard title="Live Operations Globe" className={PANEL_CLASS}>
      <div className={GLOBE_STAGE_CLASS} data-testid="operations-3d-globe">
        {hasPins ? (
          <GlobePins pins={derivedPins} className="h-full w-full" />
        ) : (
          <div className={EMPTY_STATE_CLASS}>
            {isLoading ? (
              <p className="text-[var(--text-secondary)] text-sm">Loading live fleet telemetry…</p>
            ) : (
              <>
                <p className="font-semibold text-[var(--text-heading)] text-sm">
                  No live operations to plot
                </p>
                <p className="text-[var(--text-secondary)] text-xs">
                  Active machines and breakdowns will appear here once logged.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
