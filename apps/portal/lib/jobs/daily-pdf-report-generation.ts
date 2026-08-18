import { inngest, dailyPdfReportEvent } from "@repo/utils/inngest";
import { InngestFunction } from "inngest";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";

/**
 * Daily Shift PDF & Summary Report Generation Job
 *
 * Runs automatically 15 minutes after shift closeout window (06:15 and 18:15)
 * to aggregate coal production, waste excavation, fleet hours, and breakdown metrics
 * into permanent operational report archives.
 */
interface DailyPdfReportEventData {
  date?: string;
  shiftType?: "day" | "night";
}

export const dailyPdfReportGenerationFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "daily-pdf-report-generation",
    name: "Automated Daily PDF & Shift Report Generation",
    triggers: [{ cron: "15 6,18 * * *" }, { event: dailyPdfReportEvent }],
  },
  async ({ event, step: _step }) => {
    const serviceRole = createServiceRoleClient();
    const start = performance.now();
    let success = true;

    try {
      const now = new Date();
      const eventData = event?.data as DailyPdfReportEventData | undefined;
      const targetDate = eventData?.date || now.toISOString().split("T")[0]!;
      const hour = now.getHours();
      // If run in morning (around 06:15), it summarizes previous night shift; in evening (18:15), summarizes day shift.
      const shiftType: "day" | "night" = eventData?.shiftType || (hour < 12 ? "night" : "day");

      // AGENT-TRACE: Fetch active operational departments
      const { data: departments, error: deptError } = await serviceRole
        .from("departments")
        .select("id, name, slug")
        .eq("type", "operational")
        .eq("active", true);

      if (deptError) throw deptError;

      const generatedReports: Array<{ departmentId: string; reportId: string }> = [];

      for (const dept of departments || []) {
        // Fetch production logs for the shift
        const { data: productionLogs } = await serviceRole
          .from("production_logs")
          .select("coal_tonnes, waste_tonnes, seam, pit")
          .eq("department_id", dept.id)
          .eq("date", targetDate);

        // Fetch machine hours
        const { data: machineHours } = await serviceRole
          .from("machine_hours")
          .select("hours_operated, machine_id")
          .eq("department_id", dept.id)
          .eq("date", targetDate);

        // Fetch breakdowns
        const { data: breakdowns } = await serviceRole
          .from("breakdowns")
          .select("id, status, reason, fleet_id")
          .eq("department_id", dept.id)
          .eq("date_in", targetDate);

        const totalCoal = (productionLogs || []).reduce((sum, p) => sum + (p.coal_tonnes ?? 0), 0);
        const totalWaste = (productionLogs || []).reduce(
          (sum, p) => sum + (p.waste_tonnes ?? 0),
          0,
        );
        const totalHours = (machineHours || []).reduce(
          (sum, m) => sum + (m.hours_operated ?? 0),
          0,
        );

        const reportSummary = {
          department_id: dept.id,
          date_from: targetDate,
          date_to: targetDate,
          total_shifts: 1,
          total_coal_tonnes: totalCoal,
          total_waste_tonnes: totalWaste,
          generated_at: new Date().toISOString(),
        };

        const { data: insertedReport, error: insertError } = await serviceRole
          .from("generated_reports")
          .insert(reportSummary)
          .select("id")
          .single();

        if (insertError) {
          logError(insertError, {
            context: "daily_pdf_report_insert_failed",
            departmentId: dept.id,
          });
          continue;
        }

        // Record audit trail for report archive
        await serviceRole.from("audit_logs").insert({
          action: "automated_report_archive",
          table_name: "generated_reports",
          department_id: dept.id,
          record_id: insertedReport.id,
          new_data: {
            date: targetDate,
            shift_type: shiftType,
            total_coal_tonnes: totalCoal,
            total_waste_tonnes: totalWaste,
            total_operating_hours: totalHours,
            breakdown_count: breakdowns?.length ?? 0,
          },
        });

        generatedReports.push({
          departmentId: dept.id,
          reportId: insertedReport.id,
        });
      }

      return {
        success: true,
        targetDate,
        shiftType,
        reportsGenerated: generatedReports.length,
        reports: generatedReports,
      };
    } catch (err) {
      success = false;
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "daily_pdf_report_generation_job",
      });
      throw err;
    } finally {
      recordJobExecution("daily-pdf-report-generation", performance.now() - start, success);
    }
  },
);
