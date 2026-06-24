import { inngest, aiGenerateEmbeddingEvent } from "@repo/utils/inngest";
import { generateEmbedding, batchGenerateEmbeddings } from "@/lib/ai/embeddings";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/metrics";
import type { InngestFunction } from "inngest";

export const generateEmbeddingFn: InngestFunction.Any = inngest.createFunction(
  { id: "generate-embedding", triggers: [{ event: aiGenerateEmbeddingEvent }] },
  async ({ event }) => {
    const { text, texts, userId } = event.data;
    const start = performance.now();
    let success = true;

    try {
      if (Array.isArray(texts)) {
        await batchGenerateEmbeddings(texts, userId);
      } else if (typeof text === "string" && text.trim() !== "") {
        await generateEmbedding(text, userId);
      }
      return { success: true };
    } catch (err) {
      success = false;
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "generate_embedding_job",
        userId,
        hasText: !!text,
        hasTexts: !!texts,
      });
      throw err;
    } finally {
      recordJobExecution("generate-embedding", performance.now() - start, success);
    }
  },
);
