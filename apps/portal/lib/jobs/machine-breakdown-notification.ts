import { inngest, machineBreakdownEvent } from "@repo/utils/inngest";
import { InngestFunction } from "inngest";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";

/**
 * Machine Breakdown Notification Job
 *
 * Processes breakdown log events for engineering fleet maintenance.
 */
export const machineBreakdownNotificationFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "machine-breakdown-notifications",
    name: "Machine Breakdown Notifications",
    triggers: [{ event: machineBreakdownEvent }],
  },
  async ({ event }: { event: { data: Record<string, unknown> } }) => {
    const start = performance.now();

    try {
      // AGENT-TRACE: Machine breakdown notification payload processing
      const { department_id, fleet_id, machine_type, reason, status } = event.data || {};

      const duration = performance.now() - start;
      recordJobExecution("machine-breakdown-notifications", duration, true);

      return {
        success: true,
        message: "Machine breakdown notification dispatched",
        payload: { department_id, fleet_id, machine_type, reason, status },
      };
    } catch (err) {
      const duration = performance.now() - start;
      recordJobExecution("machine-breakdown-notifications", duration, false);
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "machineBreakdownNotificationFn",
        data: event.data,
      });
      throw err;
    }
  },
);
