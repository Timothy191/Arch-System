"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { CloseShiftModal } from "./CloseShiftModal";

interface ShiftCoverageWidgetProps {
  departmentId: string;
  departmentSlug: string;
  today: string;
  currentShift: "day" | "night";
}

interface MachineWithOp {
  id: string;
  name: string;
  machine_type: string;
  hours_worked: number | null;
  has_entry: boolean;
}

export function ShiftCoverageWidget({
  departmentId,
  departmentSlug,
  today,
  currentShift,
}: ShiftCoverageWidgetProps) {
  const [machines, setMachines] = useState<MachineWithOp[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [machinesRes, opsRes] = await Promise.all([
          supabase
            .from("machines")
            .select("id, name, machine_type")
            .eq("department_id", departmentId)
            .eq("active", true)
            .order("name"),
          supabase
            .from("machine_operations")
            .select("machine_id, hours_worked")
            .eq("department_id", departmentId)
            .eq("shift_date", today)
            .eq("shift_type", currentShift),
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

        const machinesWithOps: MachineWithOp[] = (machinesRes.data || []).map(
          (m) => ({
            id: m.id,
            name: m.name,
            machine_type: m.machine_type,
            hours_worked: opsMap.get(m.id) ?? null,
            has_entry: hasEntryMap.has(m.id),
          }),
        );

        setMachines(machinesWithOps);

        const { data: statusData } = await supabase
          .from("shift_status")
          .select("status")
          .eq("department_id", departmentId)
          .eq("shift_date", today)
          .eq("shift_type", currentShift)
          .maybeSingle();

        if (statusData?.status === "closed") {
          setIsClosed(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Shift Coverage
          </h3>
          <Clock className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-[var(--bg-tertiary)] rounded-lg animate-pulse"
            />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Shift Coverage
          </h3>
          <Clock className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <p className="text-accent-red text-sm">{error}</p>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Shift Coverage
          </h3>
          <div className="flex items-center gap-2">
            {isClosed && (
              <span className="text-[10px] uppercase tracking-wider text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded-full font-medium">
                Shift Closed
              </span>
            )}
            <Clock className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
        </div>

        {machines.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm py-4 text-center">
            No machines registered
          </p>
        ) : (
          <>
            <p className="text-[var(--text-muted)] text-xs mb-3">
              {reportedCount} of {machines.length} machines reported
            </p>

            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th
                      scope="col"
                      className="text-left px-3 py-2 text-[var(--text-muted)] text-xs font-medium"
                    >
                      Machine
                    </th>
                    <th
                      scope="col"
                      className="text-right px-3 py-2 text-[var(--text-muted)] text-xs font-medium"
                    >
                      Hours
                    </th>
                    <th
                      scope="col"
                      className="text-center px-3 py-2 text-[var(--text-muted)] text-xs font-medium"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {machines.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-[var(--text-heading)]">
                        <span className="text-[var(--text-muted)] text-xs mr-1.5">
                          {m.machine_type}
                        </span>
                        {m.name}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--text-heading)]">
                        {m.hours_worked !== null
                          ? `${Number(m.hours_worked).toFixed(1)}h`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {m.has_entry &&
                        m.hours_worked !== null &&
                        m.hours_worked > 0 ? (
                          <CheckCircle className="w-4 h-4 text-accent-green mx-auto" />
                        ) : m.has_entry && m.hours_worked === 0 ? (
                          <AlertTriangle className="w-4 h-4 text-accent-blue mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-accent-red mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isClosed && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/90 text-[var(--bg-secondary)] font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                Close Shift
              </button>
            )}
          </>
        )}
      </GlassCard>

      <CloseShiftModal
        open={showModal}
        onClose={() => setShowModal(false)}
        departmentId={departmentId}
        departmentSlug={departmentSlug}
        date={today}
        shiftType={currentShift}
        onComplete={() => setShowModal(false)}
      />
    </>
  );
}
