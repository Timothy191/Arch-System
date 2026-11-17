'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { Activity, RefreshCw, Sliders, WifiOff, Zap } from 'lucide-react';
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

interface PerimeterGateHUDProps {
  initialGates: PerimeterGate[];
}

export function PerimeterGateHUD({ initialGates }: PerimeterGateHUDProps) {
  const [gates, setGates] = useState<PerimeterGate[]>(initialGates);
  const [pulsingGateId, setPulsingGateId] = useState<string | null>(null);
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

  const isRealtimeConnected = realtimeStatus === 'SUBSCRIBED';

  return (
    <GlassCard variant="window" className="p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 border-black/[0.06] border-b pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
              <span>Perimeter Barriers & Gate Telemetry HUD</span>
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

      {/* Grid of Gates */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {gates.map((gate) => {
          const isPulsing = pulsingGateId === gate.id;
          const isArmed = gate.status === 'INTERLOCK_ARMED';
          const isOnline = gate.status === 'ONLINE' || isArmed;

          return (
            <div
              key={gate.id}
              className="gold-steel-border gold-steel-border-slim flex flex-col justify-between rounded-xl border border-black/[0.07] bg-white/60 p-3.5 shadow-xs transition-all hover:border-[var(--accent-blue)]/40"
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
                <div className="mt-3 space-y-1 border-black/[0.04] border-t pt-2.5 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Cycles Today:</span>
                    <strong className="font-mono text-[var(--text-heading)]">
                      {gate.cycleCountToday}
                    </strong>
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
                  onClick={() => handlePulse(gate)}
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
