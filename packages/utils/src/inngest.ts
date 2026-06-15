import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "arch-portal",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export const syncPlaybackEvent = "sync/playback";
export const generateReportEvent = "reports/generate";
export const processImportEvent = "imports/process";
export const aiSummarizeEvent = "ai/summarize";
export const aiGenerateEmbeddingEvent = "ai/generate-embedding";
export const aiMemoryPersistEvent = "ai/memory-persist";
