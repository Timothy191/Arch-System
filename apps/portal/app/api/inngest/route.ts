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
import { machineBreakdownNotificationFn } from "@/lib/jobs/machine-breakdown-notification";
import { safetyIncidentNotificationFn } from "@/lib/jobs/safety-incident-notification";
import { insarSceneIngestionFn } from "@/lib/jobs/insar-scene-ingestion";

// AGENT-TRACE: InSAR scene ingestion cron is registered here; it populates
// `satellite_deformations` from Sentinel-1 STAC acquisitions every day at 06:00.
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
    safetyIncidentNotificationFn,
    insarSceneIngestionFn,
  ],
});
