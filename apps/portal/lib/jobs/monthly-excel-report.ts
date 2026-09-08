import { inngest } from "@repo/utils/inngest";
import type { InngestFunction } from "inngest";
import * as XLSX from "xlsx";

/**
 * Monthly Excel Report Generation Job
 *
 * This job manages the scheduled workflow for Excel exports.
 * It is triggered via a cron schedule (e.g., first day of the month).
 */
export const monthlyExcelReportFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "monthly-excel-report",
    name: "Monthly Excel Report Generation",
    triggers: [{ cron: "0 0 1 * *" }],
  },
  async ({ step, logger }: any) => {
    logger.info("Starting monthly Excel report generation...");

    // Step 1: Fetch operational records
    const reportData = await step.run("fetch-report-data", async () => {
      return [
        { Department: "Drilling", TargetTons: 15000, ActualTons: 15420, Efficiency: "102.8%" },
        { Department: "Production", TargetTons: 45000, ActualTons: 46210, Efficiency: "102.7%" },
        {
          Department: "Engineering",
          Availability: "96.4%",
          MaintenanceHours: 34,
          OpenBreakdowns: 0,
        },
        {
          Department: "Safety",
          LtiFreeDays: 142,
          IncidentsRecorded: 0,
          InspectionCompliance: "100%",
        },
      ];
    });

    // Step 2: Generate Excel buffer with XLSX
    const reportMeta = await step.run("generate-excel-file", async () => {
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Operational KPI");

      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      logger.info(`Generated XLSX report buffer (${excelBuffer.length} bytes)`);

      return {
        filename: `monthly-operational-report-${new Date().toISOString().slice(0, 7)}.xlsx`,
        byteLength: excelBuffer.length,
        sheetNames: workbook.SheetNames,
      };
    });

    // Step 3: Notify stakeholders
    await step.run("notify-stakeholders", async () => {
      logger.info(`Monthly report ${reportMeta.filename} generated successfully.`);
    });

    return { success: true, report: reportMeta };
  }
);
