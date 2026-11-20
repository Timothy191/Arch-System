import { createServiceRoleClient } from '@repo/supabase/service-role';
import { inngest, machineBreakdownEvent } from '@repo/utils/inngest';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

/**
 * Machine Breakdown Notification Job
 *
 * Processes breakdown log events for engineering fleet maintenance by recording
 * an audit trail entry for supervisory review and downstream alerting.
 */
export const machineBreakdownNotificationFn = inngest.createFunction(
  {
    id: 'machine-breakdown-notifications',
    name: 'Machine Breakdown Notifications',
    triggers: [{ event: machineBreakdownEvent }],
  },
  async ({ event }: { event: { data: Record<string, unknown> } }) => {
    const start = performance.now();

    try {
      const { department_id, fleet_id, machine_type, reason, status } = event.data || {};
      const serviceRole = createServiceRoleClient();

      const { error: auditError } = await serviceRole.from('audit_logs').insert({
        action: 'machine_breakdown_notification',
        table_name: 'breakdowns',
        department_id: typeof department_id === 'string' ? department_id : null,
        new_data: {
          fleet_id: fleet_id ?? null,
          machine_type: machine_type ?? null,
          reason: reason ?? null,
          status: status ?? null,
          timestamp: new Date().toISOString(),
        },
      });

      if (auditError) {
        throw new Error(`Failed to persist breakdown notification audit: ${auditError.message}`);
      }

      const duration = performance.now() - start;
      recordJobExecution('machine-breakdown-notifications', duration, true);

      return {
        success: true,
        message: 'Machine breakdown notification recorded',
        payload: { department_id, fleet_id, machine_type, reason, status },
      };
    } catch (err) {
      const duration = performance.now() - start;
      recordJobExecution('machine-breakdown-notifications', duration, false);
      logError(err, {
        context: 'machineBreakdownNotificationFn',
        data: event.data,
      });
      throw err;
    }
  }
);
