'use client';

import { MachineTimeAllocationInput, shiftCloseoutPayloadSchema } from '@repo/contract';
import { useOfflineQueue, usePitConnectivity } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/components/GlassCard';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ZodError } from 'zod';

export function ShiftCloseoutForm({
  deptId,
  shiftDate,
  initialFleet,
  operatorName: initialOperatorName,
}: {
  deptId: string;
  shiftDate: string;
  initialFleet: MachineTimeAllocationInput[];
  operatorName?: string;
}) {
  const { isOnline, isDegraded } = usePitConnectivity();
  const { enqueue, queue, isSyncing } = useOfflineQueue();

  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [machines, setMachines] = useState<MachineTimeAllocationInput[]>(initialFleet);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operatorName, setOperatorName] = useState<string>(initialOperatorName || '');

  // Resolve authenticated user session identity
  useEffect(() => {
    if (initialOperatorName) {
      setOperatorName(initialOperatorName);
      return;
    }

    const loadOperatorIdentity = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: employee } = await supabase
            .from('employees')
            .select('full_name')
            .eq('auth_id', user.id)
            .maybeSingle();

          if (employee?.full_name) {
            setOperatorName(employee.full_name);
            return;
          }
          if (user.user_metadata?.full_name) {
            setOperatorName(user.user_metadata.full_name);
            return;
          }
          if (user.email) {
            setOperatorName(user.email);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to resolve authenticated operator identity:', err);
      }
      setOperatorName((prev) => prev || 'Control Room Operator');
    };

    loadOperatorIdentity();
  }, [initialOperatorName]);

  const updateMachine = (id: string, field: keyof MachineTimeAllocationInput, value: any) => {
    setMachines((prev) => prev.map((m) => (m.machine_id === id ? { ...m, [field]: value } : m)));
    // Clear error for this machine when edited
    if (validationErrors[id]) {
      setValidationErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[id];
        return newErrs;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const idempotencyKey = crypto.randomUUID();
    const resolvedOperatorName = operatorName.trim() || 'Control Room Operator';

    const payload = {
      deptId,
      date: shiftDate,
      shift: shiftType,
      operatorName: resolvedOperatorName,
      idempotencyKey,
      allocations: machines,
    };

    // 1. Zod Validation (The Block)
    try {
      shiftCloseoutPayloadSchema.parse(payload);
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          // Find which machine index failed
          const match = issue.path[1];
          if (typeof match === 'number') {
            const machineId = machines[match]?.machine_id;
            if (machineId) errors[machineId] = issue.message;
          }
        });
        setValidationErrors(errors);
        toast.error(
          'Shift closeout blocked. Please resolve SMR allocation errors highlighted in red.'
        );
      }
      return; // HARD BLOCK
    }

    setIsSubmitting(true);

    // 2. Direct POST attempt when online & not degraded; route to enqueue() on network error or offline/degraded
    if (isOnline && !isDegraded) {
      try {
        const response = await fetch('/api/control-room/shift-closeout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const resBody = await response.json().catch(() => ({}));
          // If server error (5xx), fallback to offline queue
          if (response.status >= 500) {
            throw new Error(resBody.error || `Server returned ${response.status}`);
          } else {
            toast.error(resBody.error || 'Failed to submit shift closeout.');
            setIsSubmitting(false);
            return;
          }
        }

        toast.success('Shift closeout submitted and locked.');
        setIsSubmitting(false);
        return;
      } catch (_networkError) {
        // Fallback to queue on network error
        enqueue({
          url: '/api/control-room/shift-closeout',
          method: 'POST',
          body: JSON.stringify(payload),
          description: `Shift Closeout for ${shiftDate} (${shiftType})`,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
        });
        toast.warning('Network issue encountered: Closeout saved to local queue.');
        setIsSubmitting(false);
        return;
      }
    }

    // Offline or degraded connection: queue directly for reliable replay
    enqueue({
      url: '/api/control-room/shift-closeout',
      method: 'POST',
      body: JSON.stringify(payload),
      description: `Shift Closeout for ${shiftDate} (${shiftType})`,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    });

    toast.info(
      !isOnline
        ? 'Offline mode: Closeout saved to local queue.'
        : 'High-latency connection: Closeout queued for background sync.'
    );
    setIsSubmitting(false);
  };

  return (
    <GlassCard variant="spotlight" className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-heading)]">
            Shift Production & SMR Ledger
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Every machine must be accounted for. Operating SMR + Breakdowns + Delays cannot exceed
            12.5 hours (overrun reason required beyond 12.0h).
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Logged Operator:{' '}
            <span className="font-semibold text-[var(--text-heading)]">
              {operatorName || 'Resolving session...'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <span className="text-sm text-red-600 animate-pulse font-medium px-3 py-1 bg-red-500/10 rounded-full border border-red-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              Disconnected (Offline)
            </span>
          ) : isDegraded ? (
            <span className="text-sm text-amber-600 animate-pulse font-medium px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              ⚠️ High Latency (Degraded)
            </span>
          ) : (
            <span className="text-xs text-emerald-600 font-medium px-2.5 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-4 mb-4">
          <select
            value={shiftType}
            onChange={(e) => setShiftType(e.target.value as 'day' | 'night')}
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 min-h-[44px] text-sm bg-[var(--bg-secondary)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] transition-colors shadow-sm"
          >
            <option value="day">Day Shift (06:00 - 18:00)</option>
            <option value="night">Night Shift (18:00 - 06:00)</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/40 backdrop-blur-sm shadow-sm">
          <table className="min-w-full divide-y divide-[var(--border-subtle)]">
            <thead className="bg-[var(--bg-secondary)]/70">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Equipment
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Opening SMR
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Closing SMR
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Breakdown (h)
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Delays (h)
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Total Allocated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {machines.map((m) => {
                const isError = !!validationErrors[m.machine_id];
                const operatingHours = m.closing_smr - m.opening_smr;
                const totalAllocated = operatingHours + m.breakdown_hours + m.delay_hours;

                return (
                  <tr
                    key={m.machine_id}
                    className={`transition-colors ${
                      isError ? 'bg-red-500/10' : 'hover:bg-[var(--bg-secondary)]/30'
                    }`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-[var(--text-heading)]">
                      {m.machine_name}
                      {totalAllocated > 12.0 && totalAllocated <= 12.5 && (
                        <div className="mt-1.5 max-w-xs">
                          <input
                            type="text"
                            placeholder="Reason for overrun (>12.0h)..."
                            value={m.overrun_reason || ''}
                            onChange={(e) =>
                              updateMachine(m.machine_id, 'overrun_reason' as any, e.target.value)
                            }
                            className="w-full text-xs rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[var(--text-heading)] placeholder:text-amber-600/70 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}
                      {isError && (
                        <div className="text-xs text-red-600 font-normal mt-1 max-w-xs whitespace-normal">
                          {validationErrors[m.machine_id]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-mono text-[var(--text-secondary)]">
                      {m.opening_smr.toFixed(1)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        value={m.closing_smr}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'closing_smr',
                            parseFloat(e.target.value) || m.opening_smr
                          )
                        }
                        className={`w-24 rounded-lg border px-3 py-2 min-h-[44px] text-sm font-mono bg-[var(--bg-secondary)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-all shadow-sm ${
                          isError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-[var(--border-default)]'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={m.breakdown_hours}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'breakdown_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-20 rounded-lg border px-3 py-2 min-h-[44px] text-sm font-mono bg-[var(--bg-secondary)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-all shadow-sm ${
                          isError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-[var(--border-default)]'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={m.delay_hours}
                        onChange={(e) =>
                          updateMachine(
                            m.machine_id,
                            'delay_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-20 rounded-lg border px-3 py-2 min-h-[44px] text-sm font-mono bg-[var(--bg-secondary)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-all shadow-sm ${
                          isError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-[var(--border-default)]'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-sm font-mono font-medium">
                      <span
                        className={
                          totalAllocated > 12.5
                            ? 'text-red-600 font-bold'
                            : totalAllocated > 12.0
                              ? 'text-amber-500 font-bold'
                              : totalAllocated < 12.0
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                        }
                      >
                        {totalAllocated.toFixed(1)} / 12.0 h
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-muted)] font-medium">
            {queue.length > 0
              ? `${queue.length} shift record(s) buffered offline.`
              : 'Real-time sync active.'}
          </p>
          <button
            type="submit"
            disabled={isSubmitting || isSyncing}
            className="px-6 py-2.5 min-h-[44px] bg-[var(--arch-brand-blue)] hover:bg-[var(--arch-brand-blue-hover)] text-white font-medium rounded-lg shadow-sm disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-1"
          >
            {isOnline && !isDegraded ? 'Lock Shift & Compile Ledger' : 'Lock Shift (Local Queue)'}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
