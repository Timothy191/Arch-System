import { inngest, shiftRolloverNotificationEvent } from "@repo/utils/inngest";
import { InngestFunction } from "inngest";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";

/**
 * Shift Rollover Notification Job
 *
 * Runs 15 minutes before shift end (05:45 and 17:45) or upon event dispatch
 * to alert supervisors and dispatchers of pending shift closeouts and handover checklists.
 */
export const shiftRolloverNotificationFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "shift-rollover-notifications",
    name: "Shift Rollover Notifications",
    triggers: [{ cron: "45 5,17 * * *" }, { event: shiftRolloverNotificationEvent }],
  },
  async ({ step: _step }) => {
    const serviceRole = createServiceRoleClient();
    const start = performance.now();
    let success = true;
    const notifications: Array<{ department: string; status: string }> = [];

    try {
      // AGENT-TRACE: Fetch active operational departments
      const { data: departments, error: deptError } = await serviceRole
        .from("departments")
        .select("id, name, slug")
        .eq("type", "operational")
        .eq("active", true);

      if (deptError) throw deptError;
      if (!departments || departments.length === 0) {
        return { success: true, message: "No active operational departments found" };
      }

      const now = new Date();
      const hour = now.getHours();
      const currentShift = hour >= 6 && hour < 18 ? "day" : "night";
      const nextShift = currentShift === "day" ? "night" : "day";
      const today = now.toISOString().split("T")[0]!;

      for (const dept of departments) {
        // AGENT-TRACE: Check if today's shift log has already been closed out
        const { data: shiftLogs, error: logErrorDb } = await serviceRole
          .from("daily_logs")
          .select("id, status")
          .eq("department_id", dept.id)
          .eq("date", today)
          .eq("shift_type", currentShift);

        if (logErrorDb) {
          logError(logErrorDb, {
            context: "shift_rollover_check_log_error",
            departmentId: dept.id,
          });
          continue;
        }

        const isClosed =
          shiftLogs && shiftLogs.some((l) => l.status === "closed" || l.status === "verified");

        if (!isClosed) {
          // Log audit reminder event for handover
          await serviceRole.from("audit_logs").insert({
            action: "shift_rollover_reminder",
            table_name: "daily_logs",
            department_id: dept.id,
            new_data: {
              date: today,
              current_shift: currentShift,
              next_shift: nextShift,
              reminder: "Shift closeout pending before handover",
              timestamp: now.toISOString(),
            },
          });

          notifications.push({
            department: dept.name,
            status: "pending_closeout",
          });
        } else {
          notifications.push({
            department: dept.name,
            status: "closed",
          });
        }
      }

      return {
        success: true,
        currentShift,
        nextShift,
        timestamp: now.toISOString(),
        departmentsChecked: departments.length,
        notifications,
      };
    } catch (err) {
      success = false;
      logError(err, {
        context: "shift_rollover_notification_job",
      });
      throw err;
    } finally {
      recordJobExecution("shift-rollover-notifications", performance.now() - start, success);
    }
  },
);
