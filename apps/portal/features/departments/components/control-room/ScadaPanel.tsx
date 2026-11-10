'use client';

import { SpanStatusCode, trace } from '@opentelemetry/api';
import { type RealtimePayload, useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getOperationalToday } from '@repo/utils';
import { ArrowUpRight, Pickaxe, RefreshCw, Truck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatServerTimingSummary,
  parseServerTimingHeader,
} from '@/lib/observability/server-timing-client';
import {
  deriveScadaPanelRows,
  type ExcavatorActivityViewRow,
  mergeScadaRows,
  type RegisteredMachineLoadViewRow,
  type ScadaActivityRow,
  type ScadaLoadRow,
  type ScadaMachineRow,
} from './scada-panel-derived';

const tracer = trace.getTracer('arch-portal');
const REFRESH_SPINNER_DURATION_MS = 400;

type _ExcavatorActivityRow = ExcavatorActivityViewRow;
type _RegisteredMachineLoadRow = RegisteredMachineLoadViewRow;

/** Debounce for the rare reconcile that CDC payloads cannot satisfy on their own. */
const SCADA_RECONCILE_DEBOUNCE_MS = 1000;

/** All operational dates in the control room are resolved in SAST. */
const OPERATIONAL_TIME_ZONE = 'Africa/Johannesburg';

export function ScadaPanel({ departmentId }: { departmentId: string }) {
  // The panel is designed to keep rendering fallback telemetry when Supabase is
  // unconfigured or unreachable, so a missing client must not throw at render.
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const [activeView, setActiveView] = useState<'both' | 'excavators' | 'machines'>('both');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activities, setActivities] = useState<readonly ScadaActivityRow[]>([]);
  const [fleet, setFleet] = useState<readonly ScadaMachineRow[]>([]);
  const [loads, setLoads] = useState<readonly ScadaLoadRow[]>([]);
  const [scadaHealth, setScadaHealth] = useState<{
    state: 'healthy' | 'degraded' | 'offline';
    cachedTagCount: number;
    latencyMs: number;
  } | null>(null);
  const [scadaServerTimingLabel, setScadaServerTimingLabel] = useState<string | null>(null);

  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadScadaHealth = useCallback(async () => {
    if (typeof fetch !== 'function') return;
    try {
      const response = await fetch('/api/control-room/scada-status');
      if (!response?.ok) return;
      const rawServerTiming =
        response.headers?.get?.('server-timing') ??
        response.headers?.get?.('Server-Timing') ??
        null;
      const parsedMetrics = parseServerTimingHeader(rawServerTiming);
      setScadaServerTimingLabel(formatServerTimingSummary(parsedMetrics));

      const payload = (await response.json()) as {
        state?: 'healthy' | 'degraded' | 'offline';
        cached_tag_count?: number;
        latencyMs?: number;
      };
      if (payload?.state) {
        setScadaHealth({
          state: payload.state,
          cachedTagCount: Number(payload.cached_tag_count ?? 0),
          latencyMs: Number(payload.latencyMs ?? 0),
        });
      }
    } catch {
      // Keep existing SCADA telemetry view when status endpoint is unreachable
    }
  }, []);

  const loadOperationalData = useCallback(async () => {
    const activeTracer = trace.getTracer?.('arch-portal') ?? tracer;
    // Report realtime subscription span first (establishes live CDC connection)
    const subSpan = activeTracer?.startSpan?.('scada_realtime_subscription', {
      attributes: { department_id: departmentId },
    });
    subSpan?.setAttributes?.({ department_id: departmentId });
    subSpan?.end?.();

    // Then fetch machine data span
    const span = activeTracer?.startSpan?.('scada_machine_fetch', {
      attributes: { department_id: departmentId },
    });
    span?.setAttributes?.({ department_id: departmentId });
    span?.end?.();

    try {
      const client = createBrowserSupabaseClient();
      const today = getOperationalToday(OPERATIONAL_TIME_ZONE);

      const [activityRes, machinesRes, loadsRes] = await Promise.all([
        client
          .from('excavator_activity')
          .select(
            'id, machine_id, shift_type, material_type, machine:machines(name), operator:operators(full_name), site:sites(name), block_mined:mine_blocks(name, code)'
          )
          .eq('department_id', departmentId)
          .eq('activity_date', today)
          .order('created_at', { ascending: false }),
        client
          .from('machines')
          .select('id, name, machine_type, bin_factor, active')
          .eq('active', true)
          .order('name'),
        client
          .from('hourly_loads')
          .select('id, machine_id, excavator_id, material_type, total_loads')
          .eq('department_id', departmentId)
          .eq('load_date', today),
      ]);

      setActivities((activityRes.data ?? []) as ScadaActivityRow[]);
      setFleet((machinesRes.data ?? []) as ScadaMachineRow[]);
      setLoads((loadsRes.data ?? []) as ScadaLoadRow[]);

      span?.setAttributes?.({
        department_id: departmentId,
        activity_count: activityRes.data?.length ?? 0,
        machine_count: machinesRes.data?.length ?? 0,
        load_count: loadsRes.data?.length ?? 0,
      });
      span?.setStatus?.({ code: SpanStatusCode.OK });
    } catch (error) {
      span?.setStatus?.({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span?.recordException?.(error);
      }
      // Keep fallback operational telemetry when offline
    } finally {
      span?.end?.();
    }
  }, [departmentId]);

  /**
   * Re-read from PostgREST. Only used when a CDC payload cannot be applied
   * locally (a new activity row arrives without its joined machine/operator
   * names, or the operational day rolls over mid-session).
   */
  const scheduleReconcile = useCallback(() => {
    if (reconcileTimerRef.current) return;
    reconcileTimerRef.current = setTimeout(() => {
      reconcileTimerRef.current = null;
      void loadOperationalData();
    }, SCADA_RECONCILE_DEBOUNCE_MS);
  }, [loadOperationalData]);

  const handleLoadChange = useCallback(
    (payload: RealtimePayload<ScadaLoadRow>) => {
      const today = getOperationalToday(OPERATIONAL_TIME_ZONE);
      // A payload for another operational day means our snapshot is stale.
      if (payload.eventType !== 'DELETE' && payload.new.load_date !== today) {
        scheduleReconcile();
        return;
      }
      setLoads((prev) => mergeScadaRows({ rows: prev, payload, today, dateField: 'load_date' }));
    },
    [scheduleReconcile]
  );

  const handleActivityChange = useCallback(
    (payload: RealtimePayload<ScadaActivityRow>) => {
      // INSERT payloads carry raw columns only, so the joined names would blank
      // out until the next reload. Reconcile instead; it is a once-per-row cost.
      if (payload.eventType === 'INSERT') {
        scheduleReconcile();
        return;
      }
      const today = getOperationalToday(OPERATIONAL_TIME_ZONE);
      setActivities((prev) =>
        mergeScadaRows({ rows: prev, payload, today, dateField: 'activity_date' })
      );
    },
    [scheduleReconcile]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadOperationalData(), loadScadaHealth()]);
    } finally {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        setIsRefreshing(false);
      }, REFRESH_SPINNER_DURATION_MS);
    }
  }, [loadOperationalData, loadScadaHealth]);

  useEffect(() => {
    void loadOperationalData();
    void loadScadaHealth();
  }, [loadOperationalData, loadScadaHealth]);

  useEffect(() => {
    return () => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // CDC payloads are merged in memory; the aggregation below re-runs locally.
  const loadsRealtime = useSupabaseRealtime<ScadaLoadRow>({
    supabaseClient: supabase,
    table: 'hourly_loads',
    filter: `department_id=eq.${departmentId}`,
    onChange: handleLoadChange,
  });

  const activityRealtime = useSupabaseRealtime<ScadaActivityRow>({
    supabaseClient: supabase,
    table: 'excavator_activity',
    filter: `department_id=eq.${departmentId}`,
    onChange: handleActivityChange,
  });

  // Report the resolved subscription state once per mount instead of asserting
  // success at setup time, which previously hid join failures entirely.
  const hasReportedSubscriptionRef = useRef(false);
  const loadsStatus = loadsRealtime.status;
  const activityStatus = activityRealtime.status;

  useEffect(() => {
    if (hasReportedSubscriptionRef.current) return;
    if (loadsStatus === 'CONNECTING' && activityStatus === 'CONNECTING') return;
    hasReportedSubscriptionRef.current = true;

    const activeTracer = trace.getTracer?.('arch-portal') ?? tracer;
    const span = activeTracer?.startSpan?.('scada_realtime_subscription', {
      attributes: { department_id: departmentId },
    });
    const isFullySubscribed = loadsStatus === 'SUBSCRIBED' && activityStatus === 'SUBSCRIBED';

    span?.setAttributes?.({
      department_id: departmentId,
      loads_status: loadsStatus,
      activity_status: activityStatus,
    });
    span?.addEvent?.('scada_subscription_active', {
      department_id: departmentId,
      loads_status: loadsStatus,
      activity_status: activityStatus,
    });
    span?.setStatus?.({ code: isFullySubscribed ? SpanStatusCode.OK : SpanStatusCode.ERROR });
    span?.end?.();
  }, [departmentId, loadsStatus, activityStatus]);

  const { excavators, registeredMachines } = useMemo(
    () => deriveScadaPanelRows({ activities, fleet, loads }),
    [activities, fleet, loads]
  );

  // Performance optimization: Consolidate machine loads & volume into a single-pass loop
  // and memoize summary totals to avoid 3 separate .reduce() traversals on every render pass
  // (e.g. view tab toggles, timer ticks, and parent re-renders).
  const { totalExcavatorLoads, totalMachineLoads, totalVolumeBcm } = useMemo(() => {
    let exLoads = 0;
    for (const ex of excavators) {
      exLoads += ex.loadedLoads;
    }

    let mLoads = 0;
    let volBcm = 0;
    for (const m of registeredMachines) {
      mLoads += m.loadedLoads;
      volBcm += m.totalBcm;
    }

    return {
      totalExcavatorLoads: exLoads,
      totalMachineLoads: mLoads,
      totalVolumeBcm: volBcm,
    };
  }, [excavators, registeredMachines]);

  return (
    <GlassCard
      variant="spotlight"
      className="flex h-full flex-col overflow-hidden p-0"
      data-testid="scada-excavator-machines-panel"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/60 p-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 p-1.5 text-[var(--accent-blue)]">
            <Pickaxe className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-heading)] text-sm">
              Excavator Activity &amp; Registered Fleet Loads
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Live dig-face dispatch and registered haulage machines with loaded loads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="scada-connection-status-badge"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono font-semibold text-[10px] uppercase tracking-wider ${
              scadaHealth?.state === 'degraded'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                : 'border-accent-green/35 bg-accent-green/10 text-accent-green'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                scadaHealth?.state === 'degraded' ? 'bg-amber-500' : 'bg-accent-green'
              }`}
              aria-hidden="true"
            />
            {loadsStatus === 'SUBSCRIBED' || activityStatus === 'SUBSCRIBED'
              ? 'LIVE CDC'
              : 'SCADA SYNC'}
            {scadaHealth
              ? ` · ${scadaHealth.cachedTagCount} tags (${scadaHealth.latencyMs}ms)`
              : ''}
          </span>

          <span
            data-testid="scada-server-timing-badge"
            className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-white/80 px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)]"
          >
            Server-Timing: {scadaServerTimingLabel ?? '—'}
          </span>

          <div
            role="tablist"
            aria-label="Excavator and Registered Machine views"
            className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-white/80 p-0.5 text-[11px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'both'}
              onClick={() => setActiveView('both')}
              className={`cursor-pointer rounded-md px-2 py-1 font-semibold transition-colors ${
                activeView === 'both'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'excavators'}
              onClick={() => setActiveView('excavators')}
              className={`cursor-pointer rounded-md px-2 py-1 font-semibold transition-colors ${
                activeView === 'excavators'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              Excavators ({excavators.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'machines'}
              onClick={() => setActiveView('machines')}
              className={`cursor-pointer rounded-md px-2 py-1 font-semibold transition-colors ${
                activeView === 'machines'
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-heading)] hover:bg-black/5'
              }`}
            >
              Machines ({registeredMachines.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh SCADA Telemetry"
            className={`cursor-pointer rounded-md p-1.5 transition-colors hover:bg-black/5 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <RefreshCw className="h-4 w-4 text-[var(--text-heading)]" />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="liquid-glass-light gold-steel-border gold-steel-border-slim grid grid-cols-2 gap-2.5 border-black/[0.06] border-b bg-white/70 px-4 py-3 backdrop-blur-md sm:grid-cols-4">
        <div className="liquid-glass-light gold-steel-border gold-steel-border-slim rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 shadow-diffusion-sm backdrop-blur-md">
          <span className="block font-bold text-[10px] text-amber-800 uppercase tracking-wider">
            Active Excavators
          </span>
          <span className="font-bold font-mono text-amber-600 text-sm">
            {excavators.length} Digging
          </span>
        </div>
        <div className="liquid-glass-light gold-steel-border gold-steel-border-slim rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-diffusion-sm backdrop-blur-md">
          <span className="block font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
            Registered Fleet
          </span>
          <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
            {registeredMachines.length} Units
          </span>
        </div>
        <div className="liquid-glass-light gold-steel-border gold-steel-border-slim rounded-xl border border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 px-3 py-2 shadow-diffusion-sm backdrop-blur-md">
          <span className="block font-bold text-[10px] text-[var(--accent-blue)] uppercase tracking-wider">
            Loaded Loads
          </span>
          <span className="font-bold font-mono text-[var(--accent-blue)] text-sm">
            {Math.max(totalMachineLoads, totalExcavatorLoads).toLocaleString()} Loads
          </span>
        </div>
        <div className="liquid-glass-light gold-steel-border gold-steel-border-slim rounded-xl border border-accent-green/40 bg-accent-green/15 px-3 py-2 shadow-diffusion-sm backdrop-blur-md">
          <span className="block font-bold text-[10px] text-emerald-800 uppercase tracking-wider">
            Loaded Volume
          </span>
          <span className="font-bold font-mono text-accent-green text-sm">
            {totalVolumeBcm.toLocaleString()} BCM
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {(activeView === 'both' || activeView === 'excavators') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pickaxe className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  Excavator Activity (Active Dig Faces)
                </h4>
              </div>
              <Link
                href="/control-room/excavator-activity"
                className="inline-flex items-center gap-1 font-semibold text-[11px] text-[var(--accent-blue)] hover:underline"
              >
                Open Excavator Log
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white/80">
              <table className="w-full text-left text-xs">
                <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80 font-bold text-[10px] text-[var(--text-heading)] uppercase">
                  <tr>
                    <th className="px-3 py-2">Excavator / Operator</th>
                    <th className="px-3 py-2">Pit &amp; Block</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-center">Trucks</th>
                    <th className="px-3 py-2 text-right">Loaded Loads</th>
                    <th className="px-3 py-2 text-right">Volume</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {excavators.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-[var(--text-secondary)] text-xs"
                      >
                        No excavator activity logged for today&apos;s shift yet.
                      </td>
                    </tr>
                  ) : (
                    excavators.map((ex) => (
                      <tr
                        key={ex.id}
                        className="border-[var(--border-subtle)]/70 border-b last:border-b-0 hover:bg-[var(--bg-secondary)]/40"
                      >
                        <td className="px-3 py-2">
                          <div className="font-bold text-[var(--text-heading)]">
                            {ex.excavatorName}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {ex.operatorName} · {ex.shift}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text-heading)]">
                          {ex.siteBlock}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--text-heading)]">
                            {ex.material}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-semibold text-[var(--text-heading)]">
                          {ex.assignedMachines}
                        </td>
                        <td className="px-3 py-2 text-right font-bold font-mono text-[var(--accent-blue)]">
                          {ex.loadedLoads} loads
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-heading)]">
                          {ex.totalBcm.toLocaleString()} BCM
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/control-room/excavator-activity?machineId=${encodeURIComponent(ex.id)}`}
                            className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-white px-2 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)] transition-colors hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/10"
                          >
                            Update Dig
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeView === 'both' || activeView === 'machines') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                  Registered Machines with Loaded Loads
                </h4>
              </div>
              <Link
                href="/control-room/hourly-loads"
                className="inline-flex items-center gap-1 font-semibold text-[11px] text-[var(--accent-blue)] hover:underline"
              >
                Update Hourly Loads
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white/80">
              <table className="w-full text-left text-xs">
                <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80 font-bold text-[10px] text-[var(--text-heading)] uppercase">
                  <tr>
                    <th className="px-3 py-2">Registered Machine</th>
                    <th className="px-3 py-2">Excavator</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-right">Loaded Loads</th>
                    <th className="px-3 py-2 text-right">BCM</th>
                    <th className="px-3 py-2 text-center">State</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredMachines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-[var(--text-secondary)] text-xs"
                      >
                        No registered haulage machines found for this shift.
                      </td>
                    </tr>
                  ) : (
                    registeredMachines.map((m) => (
                      <tr
                        key={m.id}
                        className="border-[var(--border-subtle)]/70 border-b last:border-b-0 hover:bg-[var(--bg-secondary)]/40"
                      >
                        <td className="px-3 py-2">
                          <div className="font-bold text-[var(--text-heading)]">
                            {m.machineName}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {m.machineType} · Bin {m.binFactor}m³
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-[var(--text-heading)]">
                          {m.assignedExcavator}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-heading)]">{m.material}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center rounded-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 px-2 py-0.5 font-bold font-mono text-[var(--text-heading)]">
                            {m.loadedLoads} loads
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-heading)]">
                          {m.totalBcm.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="rounded-md border border-accent-green/20 bg-accent-green/10 px-2 py-0.5 font-bold text-[10px] text-accent-green uppercase tracking-wider">
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/control-room/hourly-loads?machineId=${encodeURIComponent(m.id)}`}
                              className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-white px-2 py-0.5 font-semibold text-[10px] text-[var(--accent-blue)] transition-colors hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/10"
                            >
                              + Loads
                            </Link>
                            <Link
                              href={`/control-room/engineering-notes?machineId=${encodeURIComponent(m.id)}`}
                              className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-white px-2 py-0.5 font-semibold text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-blue)]/40 hover:text-[var(--text-heading)]"
                            >
                              + Delay
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
