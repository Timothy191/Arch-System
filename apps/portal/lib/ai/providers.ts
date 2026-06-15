/**
 * Ollama-compatible HTTP client for chat + embedding generation.
 * Replaces external AI SDKs (Groq, OpenRouter, OpenAI) with
 * native fetch calls to a locally-running Ollama server.
 */

import { logError } from "@/lib/errors/error-logger";
import {
  OLLAMA_URL,
  DEFAULT_MODEL,
  ollamaChat,
  ollamaChatStream,
  ollamaEmbed,
  type OllamaMessage,
  type OllamaChatOptions,
} from "./ollama";

/**
 * Generate a non-streaming chat completion.
 * Convenience wrapper around ollamaChat.
 */
export async function chat(
  messages: OllamaMessage[],
  opts: OllamaChatOptions = {},
): Promise<string> {
  try {
    return await ollamaChat(messages, opts);
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "ollama_chat",
    });
    throw err;
  }
}

/**
 * Generate a streaming chat completion.
 * Returns an async iterator yielding text chunks.
 *
 * Usage in a Server Action:
 *
 *   const stream = await olamaChatStream([{role:'user',content:'hi'}]);
 *   for await (const chunk of stream) {
 *     // send chunk to client via encode/decode or SSE
 *   }
 */
async function _streamChat(
  messages: OllamaMessage[],
  opts: OllamaChatOptions = {},
): Promise<AsyncIterable<string>> {
  try {
    return ollamaChatStream(messages, opts);
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "ollama_stream_chat",
    });
    throw err;
  }
}

/**
 * Generate embeddings for one or more texts.
 * Returns an array of float vectors.
 */
async function _embed(
  input: string | string[],
  opts: { model?: string } = {},
): Promise<number[][]> {
  try {
    return ollamaEmbed(input, opts);
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "ollama_embed",
    });
    throw err;
  }
}

/** Effective model being used. */
function _getModel(): string {
  return DEFAULT_MODEL;
}

/** Ollama base URL. */
function _getBaseUrl(): string {
  return OLLAMA_URL;
}

/** Default model name (re-exported for routes that import from providers). */
export { DEFAULT_MODEL } from "./ollama";
