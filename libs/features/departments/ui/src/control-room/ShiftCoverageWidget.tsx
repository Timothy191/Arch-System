'use client';

import { AvatarGroup, Badge } from '@repo/ui';
import { EmptyState } from '@repo/ui/EmptyState';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { type CloseShiftFn, CloseShiftModal, type VerifyPinFn } from './CloseShiftModal';

export interface ShiftCoverageWidgetProps {
  departmentId: string;
  departmentSlug: string;
  today: string;
  currentShift: 'day' | 'night';
  onCloseShift?: CloseShiftFn;
  onVerifyPin?: VerifyPinFn;
}

interface MachineWithOp {
  id: string;
  name: string;
  machine_type: string;
  hours_worked: number | null;
  has_entry: boolean;
}

// AGENT-TRACE: Memoized to prevent re-renders when parent re-renders.
// Props are stable strings — re-renders only from internal state (machines, loading, etc.).
function ShiftCoverageWidgetBase({
  departmentId,
  departmentSlug,
  today,
  currentShift,
  onCloseShift,
  onVerifyPin,
}: ShiftCoverageWidgetProps) {
  const [machines, setMachines] = useState<MachineWithOp[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/control-room/shift-completeness?deptId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(today)}&shift=${encodeURIComponent(currentShift)}`,
          { method: 'GET' }
        );

        if (!res.ok) throw new Error(`Failed to load data: ${res.statusText}`);
        const data = await res.json();

        if (cancelled) return;

        const machinesWithOps: MachineWithOp[] =
          data.statuses?.map((status: any) => ({
            id: status.machineId,
            name: status.machineName,
            machine_type: status.machineType,
            hours_worked: status.hoursWorked ?? null,
            has_entry: status.hasEntry ?? false,
          })) || [];

        setMachines(machinesWithOps);

        if (data.complete) {
          setIsClosed(true);
        }
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
  }, [departmentId, today, currentShift]);

  const reportedCount = machines.filter((m) => m.has_entry).length;

  if (loading) {
    return (
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Shift Coverage</h3>
          <Clock className="h-5 w-5 text-[var(--text-muted)]" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </GlassCard>
    );
  }

  // AGENT-TRACE: UX improvement - Error handling with actionable guidance
  if (error) {
    return (
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Shift Coverage</h3>
          <Clock className="h-5 w-5 text-[var(--text-muted)]" />
        </div>
        <div className="space-y-2">
          <p className="font-medium text-accent-red text-sm">Unable to load shift coverage data</p>
          <p className="text-[var(--text-muted)] text-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[var(--accent-blue)] text-xs hover:underline"
          >
            Try refreshing the page
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] text-lg">Shift Coverage</h3>
          <div className="flex items-center gap-3">
            {isClosed && (
              <Badge variant="green" contrast="low" size="sm">
                Shift Closed
              </Badge>
            )}
            <AvatarGroup
              size={24}
              limit={4}
              overlap="auto"
              members={[
                { letter: 'CR', title: 'Control Room Lead' },
                { letter: 'OP', title: 'Shift Operator' },
                { letter: 'SO', title: 'Safety Officer' },
                { letter: 'ME', title: 'Maintenance Engineer' },
              ]}
            />
            <Clock className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
        </div>

        {machines.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Machines"
            description="No machines registered for this department."
            className="py-4"
          />
        ) : (
          <>
            <p className="mb-3 text-[var(--text-muted)] text-xs">
              {reportedCount} of {machines.length} machines reported
            </p>

            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs"
                    >
                      Machine
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium text-[var(--text-muted)] text-xs"
                    >
                      Hours
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-center font-medium text-[var(--text-muted)] text-xs"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {machines.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/50">
                      <td className="px-3 py-2 text-[var(--text-heading)]">
                        <span className="mr-1.5 text-[var(--text-muted)] text-xs">
                          {m.machine_type}
                        </span>
                        {m.name}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--text-heading)]">
                        {m.hours_worked !== null ? `${Number(m.hours_worked).toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {m.has_entry && m.hours_worked !== null && m.hours_worked > 0 ? (
                          <CheckCircle className="mx-auto h-4 w-4 text-accent-green" />
                        ) : m.has_entry && m.hours_worked === 0 ? (
                          <AlertTriangle className="mx-auto h-4 w-4 text-accent-blue" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-accent-red" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isClosed && onCloseShift && onVerifyPin && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] py-2.5 font-medium text-[var(--bg-secondary)] text-sm transition-colors hover:bg-[var(--accent-blue)]/90"
              >
                <Clock className="h-4 w-4" />
                Close Shift
              </button>
            )}
          </>
        )}
      </GlassCard>

      {onCloseShift && onVerifyPin && (
        <CloseShiftModal
          open={showModal}
          onClose={() => setShowModal(false)}
          departmentId={departmentId}
          departmentSlug={departmentSlug}
          date={today}
          shiftType={currentShift}
          onComplete={() => setShowModal(false)}
          onCloseShift={onCloseShift}
          onVerifyPin={onVerifyPin}
        />
      )}
    </>
  );
}

export const ShiftCoverageWidget = memo(ShiftCoverageWidgetBase);
