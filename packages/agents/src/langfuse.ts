import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Langfuse } from 'langfuse';

let langfuseInstance: Langfuse | null = null;
const agentTracer = trace.getTracer('@repo/agents', '1.0.0');

export interface LangfuseConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

/**
 * Returns a configured Langfuse client singleton.
 * AGENT-TRACE: Sourced from environment variables or explicit config, adhering to Langfuse best practices.
 */
export function getLangfuseClient(config?: LangfuseConfig): Langfuse | null {
  if (langfuseInstance) return langfuseInstance;

  const publicKey =
    config?.publicKey ||
    process.env.LANGFUSE_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY;
  const secretKey = config?.secretKey || process.env.LANGFUSE_SECRET_KEY;
  const baseUrl =
    config?.baseUrl ||
    process.env.LANGFUSE_BASE_URL ||
    process.env.LANGFUSE_HOST ||
    'https://us.cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    return null;
  }

  langfuseInstance = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
  });

  return langfuseInstance;
}

/**
 * Wraps an async agent or LLM operation in an OpenTelemetry span (`@opentelemetry/api`)
 * so Next.js 16 (`@vercel/otel`), BullMQ, and Langfuse OTel collectors share unified trace trees.
 */
export async function withAgentSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  return agentTracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const res = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return res;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
