import { serve } from "inngest/next";
import { inngest } from "@repo/utils/inngest";
import { syncPlaybackFn } from "@/lib/jobs/sync-playback";
import { generateReportFn } from "@/lib/jobs/report-generation";
import { generateEmbeddingFn } from "@/lib/jobs/embedding-generation";
import { memoryPersistFn } from "@/lib/jobs/memory-persist";
import { shiftCompletenessCheckFn } from "@/lib/jobs/shift-completeness-check";
import { orphanedRecordDetectionFn } from "@/lib/jobs/orphaned-record-detection";
import { shiftIntegrityReportFn } from "@/lib/reports/shift-integrity";
import { shiftRolloverNotificationFn } from "@/lib/jobs/shift-rollover-notification";
import { dailyPdfReportGenerationFn } from "@/lib/jobs/daily-pdf-report-generation";

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
  ],
});
