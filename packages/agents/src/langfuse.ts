import { Langfuse } from "langfuse";

let langfuseInstance: Langfuse | null = null;

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
    "https://us.cloud.langfuse.com";

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
