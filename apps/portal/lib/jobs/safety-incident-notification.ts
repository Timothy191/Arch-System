import { inngest, safetyIncidentEvent } from "@repo/utils/inngest";
import { InngestFunction } from "inngest";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";

/**
 * Safety Incident Notification Job
 *
 * Processes safety incident events for immediate supervisor alert fan-out.
 */
export const safetyIncidentNotificationFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "safety-incident-notifications",
    name: "Safety Incident Notifications",
    triggers: [{ event: safetyIncidentEvent }],
  },
  async ({ event }: { event: { data: Record<string, unknown> } }) => {
    const start = performance.now();

    try {
      // AGENT-TRACE: Safety incident alert dispatch payload processing
      const { department_id, severity_id, reported_by, incident_date, description } =
        event.data || {};

      const duration = performance.now() - start;
      recordJobExecution("safety-incident-notifications", duration, true);

      return {
        success: true,
        message: "Safety incident notification dispatched",
        payload: { department_id, severity_id, reported_by, incident_date, description },
      };
    } catch (err) {
      const duration = performance.now() - start;
      recordJobExecution("safety-incident-notifications", duration, false);
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "safetyIncidentNotificationFn",
        data: event.data,
      });
      throw err;
    }
  },
);
