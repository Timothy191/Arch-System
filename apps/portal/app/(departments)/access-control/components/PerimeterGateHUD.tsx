'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  CheckCircle2,
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { type PerimeterGate, triggerGatePulse } from '../actions';

interface PerimeterGateHUDProps {
  initialGates: PerimeterGate[];
}

export function PerimeterGateHUD({ initialGates }: PerimeterGateHUDProps) {
  const [gates] = useState<PerimeterGate[]>(initialGates);
  const [pulsingGateId, setPulsingGateId] = useState<string | null>(null);

  const handlePulse = async (gate: PerimeterGate) => {
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
  };

  return (
    <GlassCard variant="window" className="p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-heading)] flex items-center gap-2">
              <span>Perimeter Barriers & Gate Telemetry HUD</span>
              <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                ALL PERIMETERS ARMED
              </span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time hardware status, cycle counters, and BAC zero-tolerance breathalyzer
              interlocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
          <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>Polling: 1,000ms • SCADA Gateway</span>
        </div>
      </div>

      {/* Grid of Gates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {gates.map((gate) => {
          const isPulsing = pulsingGateId === gate.id;
          const isArmed = gate.status === 'INTERLOCK_ARMED';
          const isOnline = gate.status === 'ONLINE' || isArmed;

          return (
            <div
              key={gate.id}
              className="bg-white/60 rounded-xl border border-black/[0.07] p-3.5 flex flex-col justify-between hover:border-[var(--accent-blue)]/40 transition-all shadow-xs"
            >
              <div>
                {/* Top: Status & ID */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="font-mono text-[10px] font-bold text-[var(--text-muted)] tracking-wider">
                    {gate.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isArmed
                        ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                        : isOnline
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-700 border border-red-500/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isArmed ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    {gate.status}
                  </span>
                </div>

                {/* Name & Zone */}
                <h4 className="text-xs font-bold text-[var(--text-heading)] leading-snug line-clamp-1">
                  {gate.name}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{gate.zone}</p>

                {/* Mode Pill */}
                <div className="mt-2.5 inline-block text-[10px] font-medium font-mono text-[var(--text-secondary)] bg-black/[0.03] border border-black/[0.06] px-2 py-0.5 rounded">
                  {gate.mode}
                </div>

                {/* Telemetry Figures */}
                <div className="mt-3 pt-2.5 border-t border-black/[0.04] space-y-1 text-[11px]">
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span>Cycles Today:</span>
                    <strong className="font-mono text-[var(--text-heading)]">
                      {gate.cycleCountToday}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-muted)] text-[10px]">
                    <span>Last Event:</span>
                    <span className="font-mono">{gate.lastEventTime}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
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
                  className="w-full flex items-center justify-center gap-1.5 bg-black/[0.04] hover:bg-[var(--accent-blue)] hover:text-white disabled:opacity-50 text-[var(--text-heading)] py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  {isPulsing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Pulsing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
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
