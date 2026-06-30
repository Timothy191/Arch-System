import { serve } from "inngest/next";
import { inngest } from "@repo/utils/inngest";
import { syncPlaybackFn } from "@/lib/jobs/sync-playback";
import { generateReportFn } from "@/lib/jobs/report-generation";
import { shiftCompletenessCheckFn } from "@/lib/jobs/shift-completeness-check";
import { orphanedRecordDetectionFn } from "@/lib/jobs/orphaned-record-detection";
import { shiftIntegrityReportFn } from "@/lib/reports/shift-integrity";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncPlaybackFn,
    generateReportFn,
    shiftCompletenessCheckFn,
    orphanedRecordDetectionFn,
    shiftIntegrityReportFn,
  ],
});
