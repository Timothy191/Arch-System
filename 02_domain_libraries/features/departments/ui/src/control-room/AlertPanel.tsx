"use client";

import { useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { AcknowledgeButton } from "@repo/ui/AcknowledgeButton";
import { EmptyState } from "@repo/ui/EmptyState";
import { CheckCircle2 } from "lucide-react";
import { useThrottledState } from "@repo/shared/hooks";
import { trackClientMetric } from "@repo/shared/hooks";

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

interface AlertPreferences {
  acknowledgedMachineIds: string[];
  dismissedMachineIds: string[];
}

function storageKey(departmentId: string) {
  return `control-room-alert-prefs:${departmentId}`;
}

function readPreferences(departmentId: string): AlertPreferences {
  if (typeof window === "undefined") {
    return { acknowledgedMachineIds: [], dismissedMachineIds: [] };
  }
  try {
    const raw = sessionStorage.getItem(storageKey(departmentId));
    if (!raw) return { acknowledgedMachineIds: [], dismissedMachineIds: [] };
    const parsed = JSON.parse(raw) as Partial<AlertPreferences>;
    return {
      acknowledgedMachineIds: parsed.acknowledgedMachineIds ?? [],
      dismissedMachineIds: parsed.dismissedMachineIds ?? [],
    };
  } catch {
    return { acknowledgedMachineIds: [], dismissedMachineIds: [] };
  }
}

function writePreferences(departmentId: string, prefs: AlertPreferences) {
  sessionStorage.setItem(storageKey(departmentId), JSON.stringify(prefs));
}

export function AlertPanel({ departmentId }: AlertPanelProps) {
  const [alerts, setAlerts] = useThrottledState<Alert[]>([]);

  const persistAcknowledge = useCallback(
    (machineId: string) => {
      const prefs = readPreferences(departmentId);
      if (!prefs.acknowledgedMachineIds.includes(machineId)) {
        prefs.acknowledgedMachineIds.push(machineId);
        writePreferences(departmentId, prefs);
      }
    },
    [departmentId],
  );

  const persistDismiss = useCallback(
    (machineId: string) => {
      const prefs = readPreferences(departmentId);
      if (!prefs.dismissedMachineIds.includes(machineId)) {
        prefs.dismissedMachineIds.push(machineId);
        writePreferences(departmentId, prefs);
      }
    },
    [departmentId],
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function fetchMachines() {
      await trackClientMetric(
        "machine_status_check",
        async () => {
          const { data } = await supabase
            .from("machines")
            .select("id, name, active")
            .eq("department_id", departmentId);

          const machines = (data || []) as Machine[];
          const prefs = readPreferences(departmentId);
          const now = Date.now();
          const newAlerts: Alert[] = machines
            .filter((m) => !m.active && !prefs.dismissedMachineIds.includes(m.id))
            .map((m) => ({
              id: `offline-${m.id}`,
              machineId: m.id,
              message: `${m.name} is offline`,
              severity: "critical",
              acknowledged: prefs.acknowledgedMachineIds.includes(m.id),
              timestamp: now,
            }));

          trackClientMetric(
            "alert_generation",
            () => {
              setAlerts(newAlerts);
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
  }, [departmentId, setAlerts]);

  function acknowledge(alertId: string, machineId: string) {
    persistAcknowledge(machineId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)));
  }

  function dismiss(alertId: string, machineId: string) {
    persistDismiss(machineId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-[var(--text-heading)]">Alerts</h2>
        {unacknowledged.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/20 text-xs font-medium">
            {unacknowledged.length} unacknowledged
          </span>
        )}
      </div>

      {alerts.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="All Systems Operational"
          description="No active alerts at this time."
          className="py-8"
        />
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <GlassCard key={alert.id} className={alert.acknowledged ? "opacity-60" : ""}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    alert.severity === "critical" ? "bg-accent-red" : "bg-accent-blue"
                  }`}
                />
                <div>
                  <p className="text-[var(--text-heading)] text-sm">{alert.message}</p>
                  <p className="text-[var(--text-secondary)] text-xs">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!alert.acknowledged && (
                  <AcknowledgeButton
                    onAcknowledge={() => acknowledge(alert.id, alert.machineId)}
                    confirmTitle={`Acknowledge ${alert.machineId} Alert`}
                    confirmDescription={`Are you sure you want to acknowledge that ${alert.message}?`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => dismiss(alert.id, alert.machineId)}
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
