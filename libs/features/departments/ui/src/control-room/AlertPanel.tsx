'use client';

import { trackClientMetric, useThrottledState } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AcknowledgeButton } from '@repo/ui/AcknowledgeButton';
import { EmptyState } from '@repo/ui/EmptyState';
import { GlassCard } from '@repo/ui/GlassCard';
import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

interface Machine {
  id: string;
  name: string;
  active: boolean;
}

interface Alert {
  id: string;
  machineId: string;
  message: string;
  severity: 'warning' | 'critical';
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
        'machine_status_check',
        async () => {
          const { data } = await supabase
            .from('machines')
            .select('id, name, active')
            .eq('department_id', departmentId);

          const machines = (data || []) as Machine[];
          const now = Date.now();
          const newAlerts: Alert[] = machines
            .filter((m) => !m.active)
            .map((m) => ({
              id: `offline-${m.id}`,
              machineId: m.id,
              message: `${m.name} is offline`,
              severity: 'critical',
              acknowledged: false,
              timestamp: now,
            }));

          // AGENT-TRACE: Track alert generation
          trackClientMetric(
            'alert_generation',
            () => {
              setAlerts((prev) => {
                const acknowledged = new Set(
                  prev.filter((a) => a.acknowledged).map((a) => a.machineId)
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
            }
          );
        },
        { department_id: departmentId }
      );
    }

    fetchMachines();

    const channel = supabase
      .channel('alert-machines')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: `department_id=eq.${departmentId}`,
        },
        () => {
          fetchMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, setAlerts]);

  function acknowledge(alertId: string) {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)));
  }

  function dismiss(alertId: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-[var(--text-heading)] text-xl">Alerts</h2>
        {unacknowledged.length > 0 && (
          <span className="rounded-full border border-accent-red/20 bg-accent-red/10 px-2.5 py-1 font-medium text-accent-red text-xs">
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
          <GlassCard key={alert.id} className={alert.acknowledged ? 'opacity-60' : ''}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    alert.severity === 'critical' ? 'bg-accent-red' : 'bg-accent-blue'
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
                    onAcknowledge={() => acknowledge(alert.id)}
                    confirmTitle={`Acknowledge ${alert.machineId} Alert`}
                    confirmDescription={`Are you sure you want to acknowledge that ${alert.message}?`}
                  />
                )}
                <button
                  onClick={() => dismiss(alert.id)}
                  className="rounded-lg bg-[var(--bg-primary)] px-3 py-1 text-[var(--text-secondary)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
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
