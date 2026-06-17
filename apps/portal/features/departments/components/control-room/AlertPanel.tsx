"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { AcknowledgeButton } from "@repo/ui/AcknowledgeButton";
import { useThrottledState } from "@/hooks/useThrottledState";
import { trackClientMetric } from "@/lib/observability/client-telemetry";

interface Machine {
  id: string;
  name: string;
  active: boolean;
}

interface Alert {
  id: string;
  machineId: string;
  message: string;
  severity: "warning" | "critical";
  acknowledged: boolean;
  timestamp: number;
}

interface AlertPanelProps {
  departmentId: string;
}

export function AlertPanel({ departmentId }: AlertPanelProps) {
  const [alerts, setAlerts] = useThrottledState<Alert[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    // AGENT-TRACE: Client-side telemetry for machine status checks
    async function fetchMachines() {
      await trackClientMetric(
        "machine_status_check",
        async () => {
          const { data } = await supabase
            .from("machines")
            .select("id, name, active")
            .eq("department_id", departmentId);

          const machines = (data || []) as Machine[];
          const now = Date.now();
          const newAlerts: Alert[] = machines
            .filter((m) => !m.active)
            .map((m) => ({
              id: `offline-${m.id}`,
              machineId: m.id,
              message: `${m.name} is offline`,
              severity: "critical",
              acknowledged: false,
              timestamp: now,
            }));

          // AGENT-TRACE: Track alert generation
          trackClientMetric(
            "alert_generation",
            () => {
              setAlerts((prev) => {
                const acknowledged = new Set(
                  prev.filter((a) => a.acknowledged).map((a) => a.machineId),
                );
                return newAlerts.map((a) => ({
                  ...a,
                  acknowledged: acknowledged.has(a.machineId),
                }));
              });
            },
            {
              department_id: departmentId,
              offline_count: newAlerts.length,
              total_machines: machines.length,
            },
          );
        },
        { department_id: departmentId },
      );
    }

    fetchMachines();

    const channel = supabase
      .channel("alert-machines")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machines",
          filter: `department_id=eq.${departmentId}`,
        },
        () => {
          fetchMachines();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  function acknowledge(alertId: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
    );
  }

  function dismiss(alertId: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-[var(--text-heading)]">
          Alerts
        </h2>
        {unacknowledged.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/20 text-xs font-medium">
            {unacknowledged.length} unacknowledged
          </span>
        )}
      </div>

      {alerts.length === 0 && (
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-sm text-center py-8">
            All systems operational. No active alerts.
          </p>
        </GlassCard>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <GlassCard
            key={alert.id}
            className={alert.acknowledged ? "opacity-60" : ""}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    alert.severity === "critical"
                      ? "bg-accent-red"
                      : "bg-accent-blue"
                  }`}
                />
                <div>
                  <p className="text-[var(--text-heading)] text-sm">
                    {alert.message}
                  </p>
                  <p className="text-[var(--text-secondary)] text-xs">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!alert.acknowledged && (
                  <AcknowledgeButton
                    onAcknowledge={() => acknowledge(alert.id)}
                    confirmTitle={`Acknowledge ${alert.machineId} Alert`}
                    confirmDescription={`Are you sure you want to acknowledge that ${alert.message}?`}
                  />
                )}
                <button
                  onClick={() => dismiss(alert.id)}
                  className="px-3 py-1 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
