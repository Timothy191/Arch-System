import { aiGenerateEmbeddingEvent, inngest } from '@repo/utils/inngest';
import { batchGenerateEmbeddings, generateEmbedding } from '@/lib/ai/embeddings';
import { indexBreakdownVector, indexShiftNoteVector } from '@/lib/ai/mining-rag';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

export const generateEmbeddingFn = inngest.createFunction(
  { id: 'generate-embedding', triggers: [{ event: aiGenerateEmbeddingEvent }] },
  async ({ event }) => {
    const { text, texts, userId, breakdown, shiftNote } = event.data as {
      text?: string;
      texts?: string[];
      userId: string;
      breakdown?: Parameters<typeof indexBreakdownVector>[0];
      shiftNote?: Parameters<typeof indexShiftNoteVector>[0];
    };
    const start = performance.now();
    let success = true;

    try {
      if (breakdown) {
        await indexBreakdownVector(breakdown, userId);
      } else if (shiftNote) {
        await indexShiftNoteVector(shiftNote, userId);
      } else if (Array.isArray(texts)) {
        await batchGenerateEmbeddings(texts, userId);
      } else if (typeof text === 'string' && text.trim() !== '') {
        await generateEmbedding(text, userId);
      }
      return { success: true };
    } catch (err) {
      success = false;
      logError(err, {
        context: 'generate_embedding_job',
        userId,
        hasText: !!text,
        hasTexts: !!texts,
      });
      throw err;
    } finally {
      recordJobExecution('generate-embedding', performance.now() - start, success);
    }
  }
);
