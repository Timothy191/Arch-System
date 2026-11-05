import { getRedisClient } from './client';
import { sendSafe } from './raw';

export type PipelineCommand =
  | ['UNLINK', string, ...string[]]
  | ['DEL', string, ...string[]]
  | ['SREM', string, ...string[]]
  | ['HDEL', string, ...string[]];

export interface PipelineResult {
  index: number;
  ok: boolean;
  error?: string;
}

export async function runPipeline(
  commands: PipelineCommand[],
  { batchSize = 100 }: { batchSize?: number } = {}
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = commands.map((_, i) => ({ index: i, ok: true }));

  if (commands.length === 0) return results;

  const redis = await getRedisClient();
  if (!redis) {
    return commands.map((_, i) => ({ index: i, ok: false, error: 'Redis unavailable' }));
  }

  const chunkSize = Math.max(1, batchSize);
  const chunks: PipelineCommand[][] = [];
  for (let i = 0; i < commands.length; i += chunkSize) {
    chunks.push(commands.slice(i, i + chunkSize));
  }

  let globalIndex = 0;
  for (const chunk of chunks) {
    const chunkStart = globalIndex;
    let succeeded = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Prefer pipeline/multi if available for a single round-trip.
        const pipelineFactory =
          typeof (redis as { pipeline?: unknown }).pipeline === 'function'
            ? (
                redis as unknown as {
                  pipeline: () => { exec: () => Promise<unknown> } & Record<
                    string,
                    (...args: unknown[]) => void
                  >;
                }
              ).pipeline
            : typeof (redis as { multi?: unknown }).multi === 'function'
              ? (
                  redis as unknown as {
                    multi: () => { exec: () => Promise<unknown> } & Record<
                      string,
                      (...args: unknown[]) => void
                    >;
                  }
                ).multi
              : null;

        if (pipelineFactory) {
          const pipe = pipelineFactory();
          for (const cmd of chunk) {
            const method = cmd[0].toLowerCase();
            if (typeof pipe[method] === 'function') {
              pipe[method](...cmd.slice(1));
            }
          }
          await pipe.exec();
        } else {
          // Fallback: sequential sendSafe per command (still one chunk).
          for (const cmd of chunk) {
            await sendSafe(redis, cmd as string[]);
          }
        }
        succeeded = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!succeeded) {
      for (let i = 0; i < chunk.length; i++) {
        results[chunkStart + i] = { index: chunkStart + i, ok: false, error: lastError };
      }
    } else {
      for (let i = 0; i < chunk.length; i++) {
        results[chunkStart + i] = { index: chunkStart + i, ok: true };
      }
    }

    globalIndex += chunk.length;
  }

  return results;
}
