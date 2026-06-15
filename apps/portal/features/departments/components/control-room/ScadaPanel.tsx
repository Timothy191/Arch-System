"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { MachineControl } from "./MachineControl";
import { FuxaFrame } from "./FuxaFrame";
import { useThrottledState } from "@/hooks/useThrottledState";
import { trackClientMetric } from "@/lib/observability/client-telemetry";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  active: boolean;
  created_at: string;
}

interface ScadaPanelProps {
  departmentId: string;
}

export function ScadaPanel({ departmentId }: ScadaPanelProps) {
  const [machines, setMachines] = useThrottledState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "scada">("list");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    // AGENT-TRACE: Client-side telemetry for machine fetch operations
    async function fetchMachines() {
      await trackClientMetric(
        "scada_machines_fetch",
        async () => {
          const { data } = await supabase
            .from("machines")
            .select("id, name, machine_type, serial_number, active, created_at")
            .eq("department_id", departmentId)
            .order("name");
          setMachines(data || []);
          setLoading(false);
        },
        { department_id: departmentId },
      );
    }

    fetchMachines();

    const channel = supabase
      .channel("scada-machines")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machines",
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          // AGENT-TRACE: Track real-time subscription events
          trackClientMetric(
            "scada_realtime_update",
            () => {
              setMachines((prev) => {
                if (payload.eventType === "INSERT") {
                  return [...prev, payload.new as Machine];
                }
                if (payload.eventType === "UPDATE") {
                  return prev.map((m) =>
                    m.id === payload.new.id ? (payload.new as Machine) : m,
                  );
                }
                if (payload.eventType === "DELETE") {
                  return prev.filter((m) => m.id !== payload.old.id);
                }
                return prev;
              });
            },
            {
              department_id: departmentId,
              event_type: payload.eventType,
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const activeCount = machines.filter((m) => m.active).length;
  const inactiveCount = machines.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-[var(--text-heading)]">
          SCADA Overview
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
            {activeCount} Online
          </span>
          <span className="px-2.5 py-1 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/20">
            {inactiveCount} Offline
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            viewMode === "list"
              ? "bg-arch-accent-green text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          Machine List
        </button>
        <button
          type="button"
          onClick={() => setViewMode("scada")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            viewMode === "scada"
              ? "bg-arch-accent-green text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
          }`}
        >
          SCADA Dashboard
        </button>
      </div>

      {viewMode === "list" ? (
        <>
          {loading && (
            <p className="text-[var(--text-secondary)] text-sm">
              Loading machines...
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {machines.map((machine) => (
              <GlassCard key={machine.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[var(--text-heading)] font-medium">
                      {machine.name}
                    </p>
                    <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                      {machine.machine_type}
                    </p>
                    {machine.serial_number && (
                      <p className="text-[var(--text-secondary)] text-xs">
                        SN: {machine.serial_number}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      machine.active
                        ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                        : "bg-accent-red/10 text-accent-red border border-accent-red/20"
                    }`}
                  >
                    {machine.active ? "Online" : "Offline"}
                  </span>
                </div>
              </GlassCard>
            ))}

            {!loading && machines.length === 0 && (
              <GlassCard>
                <p className="text-[var(--text-secondary)] text-sm text-center py-8">
                  No machines registered for this department.
                </p>
              </GlassCard>
            )}
          </div>

          <MachineControl />
        </>
      ) : (
        <FuxaFrame departmentId={departmentId} />
      )}
    </div>
  );
}
