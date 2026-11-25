'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Activity, BarChart3, RefreshCw, ShieldCheck, Sliders, WifiOff, Zap } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type PerimeterGate, triggerGatePulse } from '../actions';

const GATE_LOCATION_TO_ID: Record<string, string> = {
  'Main Gate': 'GATE-01-NORTH',
  'Main Gate Exit': 'GATE-02-SOUTH',
  Turnstile: 'TURN-01-04-PIT',
  'ROM Weighbridge': 'WEIGH-03-ROM',
  'Explosives Magazine': 'VAULT-05-MAG',
};

const BAR_CHART_WIDTH = 420;
const BAR_CHART_HEIGHT = 132;
const RING_RADIUS = 38;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const GRAPH_PANEL_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-xl border border-accent-gold/55 bg-white p-4 shadow-2xs';

interface PerimeterGateHUDProps {
  initialGates: PerimeterGate[];
}

export function PerimeterGateHUD({ initialGates }: PerimeterGateHUDProps) {
  const [gates, setGates] = useState<PerimeterGate[]>(initialGates);
  const [pulsingGateId, setPulsingGateId] = useState<string | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(initialGates[0]?.id ?? null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  // Realtime CDC subscription: stream new access_logs inserts into the gate HUD
  const { status: realtimeStatus, error: realtimeError } = useSupabaseRealtime({
    supabaseClient: supabase,
    table: 'access_logs',
    event: 'INSERT',
    onInsert: useCallback((record: Record<string, unknown>) => {
      const gateLocation = record.gate_location as string | undefined;
      const gateId = GATE_LOCATION_TO_ID[gateLocation ?? ''];
      if (!gateId) return;

      const badgeId = record.badge_id as string | undefined;
      setGates((current) =>
        current.map((g) => {
          if (g.id !== gateId) return g;
          return {
            ...g,
            cycleCountToday: g.cycleCountToday + 1,
            lastEventTime: 'Just now',
            lastEntityPassed: badgeId ? `Badge ${badgeId.slice(0, 8)}` : 'Unknown badge',
          };
        })
      );
    }, []),
  });

  const handlePulse = useCallback(async (gate: PerimeterGate) => {
    try {
      setPulsingGateId(gate.id);
      const res = await triggerGatePulse(
        gate.name,
        `Authorized remote pulse from SOC Terminal (Gate: ${gate.id})`
      );
      toast.success(res.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to pulse gate barrier';
      toast.error(message);
    } finally {
      setPulsingGateId(null);
    }
  }, []);

  const telemetryStats = useMemo(() => {
    const totalCycles = gates.reduce((sum, g) => sum + g.cycleCountToday, 0);
    const maxCycles = Math.max(...gates.map((g) => g.cycleCountToday), 1);
    const avgCycles = gates.length > 0 ? Math.round(totalCycles / gates.length) : 0;
    const onlineCount = gates.filter(
      (g) => g.status === 'ONLINE' || g.status === 'INTERLOCK_ARMED'
    ).length;
    const interlockCount = gates.filter(
      (g) => g.interlockActive || g.status === 'INTERLOCK_ARMED'
    ).length;
    const readinessPct = gates.length > 0 ? Math.round((onlineCount / gates.length) * 100) : 0;
    const interlockPct = gates.length > 0 ? Math.round((interlockCount / gates.length) * 100) : 0;

    return {
      totalCycles,
      maxCycles,
      avgCycles,
      onlineCount,
      interlockCount,
      readinessPct,
      interlockPct,
    };
  }, [gates]);

  const isRealtimeConnected = realtimeStatus === 'SUBSCRIBED';
  const strokeDashoffset =
    RING_CIRCUMFERENCE - (telemetryStats.readinessPct / 100) * RING_CIRCUMFERENCE;

  return (
    <GlassCard variant="window" className="p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 border-black/[0.06] border-b pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <span>Perimeter Barriers &amp; Gate Telemetry HUD</span>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono font-semibold text-[11px] text-emerald-700">
                ALL PERIMETERS ARMED
              </span>
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Real-time hardware status, cycle counters, and BAC zero-tolerance breathalyzer
              interlocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[var(--text-secondary)] text-xs">
          {isRealtimeConnected ? (
            <>
              <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
              <span>Realtime CDC • Supabase</span>
              <span className="text-[var(--text-muted)]">
                (Perimeter Barriers &amp; Gate telemetry)
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
              <span>
                Realtime {realtimeStatus.toLowerCase()}{' '}
                {realtimeError ? `— ${realtimeError.message}` : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Telemetry Graphs Row */}
      <div
        data-testid="perimeter-hud-graphs"
        className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Graph 1: Per-Gate Cycle Throughput Bar Chart */}
        <div className={cn(GRAPH_PANEL_CLASS, 'lg:col-span-7')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent-gold" />
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Gate Cycle Throughput Today
              </h4>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
              <span>Total: {telemetryStats.totalCycles.toLocaleString('en-US')}</span>
              <span>•</span>
              <span>Avg: {telemetryStats.avgCycles}/gate</span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${BAR_CHART_WIDTH} ${BAR_CHART_HEIGHT}`}
            className="h-32 w-full overflow-visible"
            role="img"
            aria-label="Perimeter gate cycle throughput graph"
          >
            {/* Average throughput reference line */}
            {telemetryStats.maxCycles > 0 && (
              <line
                x1={12}
                y1={
                  BAR_CHART_HEIGHT - 26 - (telemetryStats.avgCycles / telemetryStats.maxCycles) * 86
                }
                x2={BAR_CHART_WIDTH - 12}
                y2={
                  BAR_CHART_HEIGHT - 26 - (telemetryStats.avgCycles / telemetryStats.maxCycles) * 86
                }
                stroke="var(--accent-gold, currentColor)"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.7"
              />
            )}

            {gates.map((gate, idx) => {
              const slotWidth = (BAR_CHART_WIDTH - 24) / Math.max(gates.length, 1);
              const barWidth = Math.min(44, Math.max(20, slotWidth * 0.56));
              const centerX = 12 + idx * slotWidth + slotWidth / 2;
              const barHeight = Math.max(8, (gate.cycleCountToday / telemetryStats.maxCycles) * 86);
              const y = BAR_CHART_HEIGHT - 26 - barHeight;
              const isSelected = selectedGateId === gate.id;
              const isArmed = gate.status === 'INTERLOCK_ARMED';
              const isOnline = gate.status === 'ONLINE' || isArmed;
              const fillColor = isSelected
                ? 'var(--accent-gold, currentColor)'
                : isArmed
                  ? 'var(--accent-amber, currentColor)'
                  : isOnline
                    ? 'var(--accent-green, currentColor)'
                    : 'var(--accent-red, currentColor)';

              return (
                <g
                  key={gate.id}
                  onClick={() => setSelectedGateId(gate.id)}
                  onMouseEnter={() => setSelectedGateId(gate.id)}
                  className="cursor-pointer"
                >
                  <rect
                    x={centerX - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={6}
                    fill={fillColor}
                    fillOpacity={isSelected ? 0.92 : 0.72}
                  />
                  <text
                    x={centerX}
                    y={Math.max(10, y - 5)}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="700"
                    fill="currentColor"
                  >
                    {gate.cycleCountToday}
                  </text>
                  <text
                    x={centerX}
                    y={BAR_CHART_HEIGHT - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={isSelected ? '700' : '500'}
                    fill="currentColor"
                    opacity={isSelected ? 0.95 : 0.65}
                  >
                    {gate.id.split('-').slice(0, 2).join('-')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Graph 2: Barrier Readiness & BAC Interlock Distribution */}
        <div className={cn(GRAPH_PANEL_CLASS, 'flex flex-col justify-between lg:col-span-5')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Barrier &amp; BAC Readiness
              </h4>
            </div>
            <span className="font-mono font-semibold text-[11px] text-emerald-700">
              {telemetryStats.onlineCount}/{gates.length} Online
            </span>
          </div>

          <div className="flex items-center gap-4">
            <svg
              viewBox="0 0 100 100"
              className="h-24 w-24 shrink-0"
              role="img"
              aria-label="Perimeter readiness radial chart"
            >
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--accent-gold, currentColor)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="49"
                textAnchor="middle"
                fontSize="16"
                fontWeight="800"
                fontFamily="monospace"
                fill="currentColor"
              >
                {telemetryStats.readinessPct}%
              </text>
              <text
                x="50"
                y="63"
                textAnchor="middle"
                fontSize="8"
                fontFamily="monospace"
                fill="currentColor"
                opacity="0.65"
              >
                ARMED
              </text>
            </svg>

            <div className="min-w-0 flex-1 space-y-2.5 text-xs">
              <div>
                <div className="mb-1 flex items-center justify-between font-medium text-[11px]">
                  <span className="text-slate-700">Online Barriers</span>
                  <span className="font-bold font-mono text-emerald-700">
                    {telemetryStats.readinessPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${telemetryStats.readinessPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between font-medium text-[11px]">
                  <span className="text-slate-700">BAC Interlocks Armed</span>
                  <span className="font-bold font-mono text-amber-700">
                    {telemetryStats.interlockPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${telemetryStats.interlockPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Gates */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {gates.map((gate) => {
          const isPulsing = pulsingGateId === gate.id;
          const isArmed = gate.status === 'INTERLOCK_ARMED';
          const isOnline = gate.status === 'ONLINE' || isArmed;
          const isHighlighted = selectedGateId === gate.id;
          const cycleSharePct = Math.round((gate.cycleCountToday / telemetryStats.maxCycles) * 100);

          return (
            <div
              key={gate.id}
              onClick={() => setSelectedGateId(gate.id)}
              className={`gold-steel-border gold-steel-border-slim flex flex-col justify-between rounded-xl border bg-white p-3.5 shadow-xs transition-all hover:border-accent-gold ${
                isHighlighted
                  ? 'border-accent-gold ring-2 ring-accent-gold/25'
                  : 'border-accent-gold/45'
              }`}
            >
              <div>
                {/* Top: Status & ID */}
                <div className="mb-2 flex items-center justify-between gap-1.5">
                  <span className="font-bold font-mono text-[10px] text-[var(--text-muted)] tracking-wider">
                    {gate.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[10px] ${
                      isArmed
                        ? 'border border-amber-500/20 bg-amber-500/10 text-amber-700'
                        : isOnline
                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                          : 'border border-red-500/20 bg-red-500/10 text-red-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isArmed ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    {gate.status}
                  </span>
                </div>

                {/* Name & Zone */}
                <h4 className="line-clamp-1 font-bold text-[var(--text-heading)] text-xs leading-snug">
                  {gate.name}
                </h4>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{gate.zone}</p>

                {/* Mode Pill */}
                <div className="mt-2.5 inline-block rounded border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 font-medium font-mono text-[10px] text-[var(--text-secondary)]">
                  {gate.mode}
                </div>

                {/* Telemetry Figures */}
                <div className="mt-3 space-y-1.5 border-black/[0.04] border-t pt-2.5 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Cycles Today:</span>
                    <strong className="font-mono text-[var(--text-heading)]">
                      {gate.cycleCountToday}
                    </strong>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-accent-gold transition-all"
                      style={{ width: `${Math.max(8, cycleSharePct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span>Last Event:</span>
                    <span className="font-mono">{gate.lastEventTime}</span>
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-muted)]">
                    <span>Target: </span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {gate.lastEntityPassed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Pulse Button */}
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePulse(gate);
                  }}
                  disabled={isPulsing}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 py-1.5 font-semibold text-[var(--text-heading)] text-xs transition-all hover:bg-[var(--accent-blue)] hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {isPulsing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Pulsing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Pulse Barrier</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
