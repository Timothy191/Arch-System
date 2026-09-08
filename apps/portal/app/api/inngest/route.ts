import { inngest } from "@repo/utils/inngest";
import { serve } from "inngest/next";
import { dailyPdfReportGenerationFn } from "@/lib/jobs/daily-pdf-report-generation";
import { generateEmbeddingFn } from "@/lib/jobs/embedding-generation";
import { machineBreakdownNotificationFn } from "@/lib/jobs/machine-breakdown-notification";
import { memoryPersistFn } from "@/lib/jobs/memory-persist";
import { monthlyExcelReportFn } from "@/lib/jobs/monthly-excel-report";
import { orphanedRecordDetectionFn } from "@/lib/jobs/orphaned-record-detection";
import { generateReportFn } from "@/lib/jobs/report-generation";
import { shiftCompletenessCheckFn } from "@/lib/jobs/shift-completeness-check";
import { shiftRolloverNotificationFn } from "@/lib/jobs/shift-rollover-notification";
import { syncPlaybackFn } from "@/lib/jobs/sync-playback";
import { shiftIntegrityReportFn } from "@/lib/reports/shift-integrity";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncPlaybackFn,
    generateReportFn,
    generateEmbeddingFn,
    memoryPersistFn,
    shiftCompletenessCheckFn,
    orphanedRecordDetectionFn,
    shiftIntegrityReportFn,
    shiftRolloverNotificationFn,
    dailyPdfReportGenerationFn,
    machineBreakdownNotificationFn,
    monthlyExcelReportFn,
  ],
});
