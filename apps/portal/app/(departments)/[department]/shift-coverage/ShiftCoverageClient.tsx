'use client';

import { CloseShiftModal } from '@repo/departments/ui';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { ShiftToggle } from '@repo/ui/ShiftToggle';
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { closeShift, verifyPin } from '@/lib/shift-closeout';

interface ShiftCoverageClientProps {
  departmentId: string;
  departmentSlug: string;
  initialDate: string;
  initialShift: 'day' | 'night';
}

interface MachineWithOp {
  id: string;
  name: string;
  machine_type: string;
  hours_worked: number | null;
  has_entry: boolean;
}

interface ShiftHistoryItem {
  id: string;
  shift_date: string;
  shift_type: 'day' | 'night';
  closed_at: string;
}

export function ShiftCoverageClient({
  departmentId,
  departmentSlug,
  initialDate,
  initialShift,
}: ShiftCoverageClientProps) {
  const supabase = createBrowserSupabaseClient();
  const [date, setDate] = useState(initialDate);
  const [shiftType, setShiftType] = useState<'day' | 'night'>(initialShift);
  const [machines, setMachines] = useState<MachineWithOp[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ShiftHistoryItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [machinesRes, opsRes] = await Promise.all([
          supabase
            .from('machines')
            .select('id, name, machine_type')
            .eq('active', true)
            .order('name'),
          supabase
            .from('machine_operations')
            .select('machine_id, hours_worked')
            .eq('department_id', departmentId)
            .eq('shift_date', date)
            .eq('shift_type', shiftType),
        ]);

        if (cancelled) return;

        if (machinesRes.error) throw machinesRes.error;
        if (opsRes.error) throw opsRes.error;

        const opsMap = new Map<string, number | null>();
        const hasEntryMap = new Map<string, boolean>();
        for (const op of opsRes.data || []) {
          opsMap.set(op.machine_id, op.hours_worked);
          hasEntryMap.set(op.machine_id, true);
        }

        const machinesWithOps: MachineWithOp[] = (machinesRes.data || []).map((m) => ({
          id: m.id,
          name: m.name,
          machine_type: m.machine_type,
          hours_worked: opsMap.get(m.id) ?? null,
          has_entry: hasEntryMap.has(m.id),
        }));

        setMachines(machinesWithOps);

        const { data: statusData } = await supabase
          .from('shift_status')
          .select('status')
          .eq('department_id', departmentId)
          .eq('shift_date', date)
          .eq('shift_type', shiftType)
          .maybeSingle();

        setIsClosed(statusData?.status === 'closed');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [departmentId, date, shiftType, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      const { data } = await supabase
        .from('shift_status')
        .select('id, shift_date, shift_type, closed_at')
        .eq('department_id', departmentId)
        .order('shift_date', { ascending: false })
        .limit(20);

      if (!cancelled && data) {
        setHistory(data as ShiftHistoryItem[]);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [departmentId, supabase]);

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0] || '');
  };

  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0] || '');
  };

  const reportedCount = machines.filter((m) => m.has_entry).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-2xl text-[var(--text-heading)]">Shift Coverage</h2>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevDay}
              aria-label="Previous day"
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-medium text-[var(--text-heading)] text-sm">
              {new Date(date).toLocaleDateString('en-ZA', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={nextDay}
              aria-label="Next day"
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="w-48">
            <ShiftToggle value={shiftType} onChange={setShiftType} />
          </div>
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg border border-accent-red/20 bg-accent-red/10 p-3">
          <p className="text-accent-red text-sm">{error}</p>
        </div>
      )}

      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[var(--text-heading)] text-lg">Machine Coverage</h3>
            {isClosed && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 font-semibold text-[9px] text-emerald-700 uppercase tracking-wider">
                <span className="badge-pulse-dot bg-emerald-500" />
                Closed
              </span>
            )}
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {loading ? 'Loading...' : `${reportedCount} / ${machines.length} reported`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />
            ))}
          </div>
        ) : machines.length === 0 ? (
          <p className="py-8 text-center text-[var(--text-muted)] text-sm">
            No machines registered
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-[var(--text-muted)] text-xs"
                  >
                    Machine
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium text-[var(--text-muted)] text-xs"
                  >
                    Hours
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-center font-medium text-[var(--text-muted)] text-xs"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {machines.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/50">
                    <td className="px-4 py-2.5 text-[var(--text-heading)]">
                      <span className="mr-2 text-[var(--text-muted)] text-xs uppercase">
                        {m.machine_type}
                      </span>
                      {m.name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--text-heading)] tabular-nums">
                      {m.hours_worked !== null ? `${Number(m.hours_worked).toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {m.has_entry && m.hours_worked !== null && m.hours_worked > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <CheckCircle className="h-4 w-4 text-accent-green" />
                          <span className="text-accent-green text-xs">Reported</span>
                        </div>
                      ) : m.has_entry && m.hours_worked === 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-accent-blue" />
                          <span className="text-accent-blue text-xs">Partial</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <XCircle className="h-4 w-4 text-accent-red" />
                          <span className="text-accent-red text-xs">Missing</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !isClosed && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-cyan)] py-2.5 font-medium text-[var(--bg-secondary)] text-sm transition-colors hover:bg-[var(--accent-cyan)]/90"
          >
            <Clock className="h-4 w-4" />
            Close Shift
          </button>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 font-bold text-[var(--text-heading)] text-lg">Close-out History</h3>

        {history.length === 0 ? (
          <p className="py-4 text-center text-[var(--text-muted)] text-sm">
            No previous close-outs
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-[var(--text-muted)] text-xs"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-[var(--text-muted)] text-xs"
                  >
                    Shift
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-medium text-[var(--text-muted)] text-xs"
                  >
                    Closed At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {history.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/50">
                    <td className="px-4 py-2.5 text-[var(--text-heading)]">
                      {new Date(item.shift_date).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium text-xs ${
                          item.shift_type === 'day'
                            ? 'border border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
                            : 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-400'
                        }`}
                      >
                        {item.shift_type === 'day' ? 'Day' : 'Night'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs">
                      {new Date(item.closed_at).toLocaleString('en-ZA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <CloseShiftModal
        open={showModal}
        onClose={() => setShowModal(false)}
        departmentId={departmentId}
        departmentSlug={departmentSlug}
        date={date}
        shiftType={shiftType}
        onComplete={() => {
          setShowModal(false);
          window.location.reload();
        }}
        onCloseShift={closeShift}
        onVerifyPin={verifyPin}
      />
    </div>
  );
}
