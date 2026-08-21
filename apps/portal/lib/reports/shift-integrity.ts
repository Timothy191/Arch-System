import { inngest } from "@repo/utils/inngest";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";

/**
 * Shift Integrity Report Job
 *
 * Runs weekly to generate shift integrity metrics including
 * % shifts closed on time, data quality score, and operational KPIs.
 *
 * Schedule: Weekly on Sunday at 03:00
 * Delivery: Email to supervisors, dashboard for admins
 */

import { InngestFunction } from "inngest";

/**
 * Operational timezone for the mine. All shift windows are defined in SAST.
 */
const OPERATIONAL_TIMEZONE = "Africa/Johannesburg";

/**
 * Adds `days` days to a YYYY-MM-DD string (calendar arithmetic in UTC, which is
 * safe for date-only values).
 */
export function addDays(dateStr: string, days: number): string {
  const [year = NaN, month = NaN, day = NaN] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().split("T")[0]!;
}

/**
 * Returns the UTC instant corresponding to `HH:MM` on `dateStr` (YYYY-MM-DD)
 * in the operational timezone, using the Intl offset technique. This keeps the
 * "closed on time" window deterministic regardless of the server's own timezone
 * (previously `setHours` used server-local time, which shifted the window by
 * the host offset — a real bug for any host not on UTC).
 */
export function timeAtOperationalZone(
  dateStr: string,
  time: string,
  timeZone: string = OPERATIONAL_TIMEZONE,
): Date {
  const [year = NaN, month = NaN, day = NaN] = dateStr.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  });
  const zoneHour = Number(
    formatter.formatToParts(new Date(utcGuess)).find((p) => p.type === "hour")?.value,
  );
  const utcHour = new Date(utcGuess).getUTCHours();
  // Shift the guess by the zone's offset so the result is `time` in that zone.
  return new Date(utcGuess - (zoneHour - utcHour) * 3600000);
}

export const shiftIntegrityReportFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "shift-integrity-report",
    triggers: [{ cron: "0 3 * * 0" }],
  },
  async () => {
    const serviceRole = createServiceRoleClient();
    const start = performance.now();
    let success = true;

    try {
      // AGENT-TRACE: Calculate date range for the past week
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // AGENT-TRACE: Get all shift statuses for the week
      const { data: shiftStatuses, error: shiftError } = await serviceRole
        .from("shift_status")
        .select("*")
        .gte("shift_date", startDateStr)
        .lte("shift_date", endDateStr)
        .order("shift_date", { ascending: true });

      if (shiftError) throw shiftError;

      // AGENT-TRACE: Calculate shift completion metrics
      const totalShifts = shiftStatuses?.length || 0;
      const closedShifts = shiftStatuses?.filter((s) => s.status === "closed") || [];
      const shiftsClosedOnTime = closedShifts.filter((s) => {
        // AGENT-TRACE: Consider shift closed "on time" if closed within 2 hours of
        // shift end, evaluated in the operational timezone (SAST):
        //   Day shift ends 18:00 (+2h grace = 20:00 SAST same day)
        //   Night shift ends 06:00 the NEXT day (+2h grace = 08:00 SAST next day)
        const shiftType = s.shift_type;
        const graceTime = shiftType === "day" ? "20:00" : "08:00";
        const graceDate = shiftType === "night" ? addDays(s.shift_date, 1) : s.shift_date;
        const expectedEndTime = timeAtOperationalZone(graceDate, graceTime);
        const closedAt = new Date(s.closed_at);
        return !Number.isNaN(closedAt.getTime()) && closedAt <= expectedEndTime;
      });

      const onTimeCloseRate = totalShifts > 0 ? (shiftsClosedOnTime.length / totalShifts) * 100 : 0;

      // AGENT-TRACE: Calculate data quality score
      const { data: completenessAlerts, error: alertError } = await serviceRole
        .from("shift_completeness_alerts")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (alertError) throw alertError;

      const totalAlerts = completenessAlerts?.length || 0;
      const unresolvedAlerts = completenessAlerts?.filter((a) => !a.resolved) || [];

      // AGENT-TRACE: Data quality score (higher is better)
      // Base score: 100, subtract 5 points per unresolved alert, minimum 0
      const dataQualityScore = Math.max(0, 100 - unresolvedAlerts.length * 5);

      // AGENT-TRACE: Get data integrity issues for the week
      const { data: integrityIssues, error: issuesError } = await serviceRole
        .from("data_integrity_issues")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (issuesError) throw issuesError;

      const totalIssues = integrityIssues?.length || 0;
      const unresolvedIssues = integrityIssues?.filter((i) => !i.resolved) || [];
      const highSeverityIssues =
        unresolvedIssues?.filter((i) => i.severity === "high" || i.severity === "critical") || [];

      // AGENT-TRACE: Calculate operational KPIs
      const { data: machines, error: machineError } = await serviceRole
        .from("machines")
        .select("id, active, department_id")
        .eq("active", true);

      if (machineError) throw machineError;

      const totalActiveMachines = machines?.length || 0;

      const { data: machineOps, error: opsError } = await serviceRole
        .from("machine_operations")
        .select("id, operation_date, department_id")
        .gte("operation_date", startDateStr)
        .lte("operation_date", endDateStr);

      if (opsError) throw opsError;

      const totalOperations = machineOps?.length || 0;

      // AGENT-TRACE: Generate report summary
      const reportSummary = {
        period: {
          start_date: startDateStr,
          end_date: endDateStr,
          generated_at: new Date().toISOString(),
        },
        shift_metrics: {
          total_shifts: totalShifts,
          closed_shifts: closedShifts.length,
          shifts_closed_on_time: shiftsClosedOnTime.length,
          on_time_close_rate: Number(onTimeCloseRate.toFixed(2)),
        },
        data_quality: {
          total_alerts: totalAlerts,
          unresolved_alerts: unresolvedAlerts.length,
          data_quality_score: dataQualityScore,
        },
        data_integrity: {
          total_issues: totalIssues,
          unresolved_issues: unresolvedIssues.length,
          high_severity_unresolved: highSeverityIssues.length,
        },
        operational_kpis: {
          active_machines: totalActiveMachines,
          total_operations: totalOperations,
          avg_operations_per_day: totalOperations > 0 ? (totalOperations / 7).toFixed(2) : 0,
        },
      };

      // AGENT-TRACE: Store report in database
      const { error: insertError } = await serviceRole.from("shift_integrity_reports").insert({
        report_data: reportSummary,
        report_date: endDateStr,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      const result = {
        success: true,
        report: reportSummary,
      };

      return result;
    } catch (err) {
      success = false;
      logError(err, {
        context: "shift_integrity_report_job",
      });
      throw err;
    } finally {
      recordJobExecution("shift-integrity-report", performance.now() - start, success);
    }
  },
);
