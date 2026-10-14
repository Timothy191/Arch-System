/**
 * @file openrouter.ts
 * @description OpenRouter AI SDK Provider & Prefix Caching / Structured Output Integration for @repo/agents.
 * Bridges Vercel AI SDK (`ai`) + `@openrouter/ai-sdk-provider` + `gpt-tokenizer` + OpenTelemetry.
 */

import { createOpenRouter, type OpenRouterProvider } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { countTokens } from 'gpt-tokenizer';
import { withAgentSpan } from './langfuse';

export interface OpenRouterClientConfig {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}

export interface CachedPromptOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  enablePrefixCache?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface OpenRouterExecutionReceipt {
  text: string;
  model: string;
  promptTokensEstimate: number;
  completionTokensEstimate: number;
  prefixCacheEnabled: boolean;
}

/**
 * Creates a configured `@openrouter/ai-sdk-provider` instance.
 */
export function createOpenRouterProvider(config: OpenRouterClientConfig = {}): OpenRouterProvider {
  const apiKey =
    config.apiKey ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.OPENAI_API_KEY ||
    'sk-or-placeholder';

  return createOpenRouter({
    apiKey,
    baseURL: config.baseURL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://arch-system.local',
      'X-Title': 'Arch-System Agent Coordinator',
      ...config.headers,
    },
  });
}

/**
 * Counts exact o200k_base BPE tokens for a prompt or context payload using `gpt-tokenizer`.
 */
export function countPromptTokens(text: string): number {
  if (!text) return 0;
  return countTokens(text);
}

/**
 * Executes a prompt via `@openrouter/ai-sdk-provider` with optional ephemeral prefix-caching breakpoints
 * and OpenTelemetry span instrumentation.
 */
export async function executeOpenRouterPrompt(
  options: CachedPromptOptions,
  clientConfig: OpenRouterClientConfig = {}
): Promise<OpenRouterExecutionReceipt> {
  const modelId = options.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const enablePrefixCache = options.enablePrefixCache ?? true;
  const openrouter = createOpenRouterProvider(clientConfig);

  return withAgentSpan(
    'openrouter.generateText',
    {
      'llm.provider': 'openrouter',
      'llm.model': modelId,
      'llm.prefix_cache': enablePrefixCache,
      'llm.prompt_tokens_bpe': countPromptTokens(options.systemPrompt + '\n' + options.userPrompt),
    },
    async () => {
      const result = await generateText({
        model: openrouter(modelId),
        messages: [
          {
            role: 'system',
            content: options.systemPrompt,
            providerOptions: enablePrefixCache
              ? {
                  openrouter: {
                    cacheControl: { type: 'ephemeral' },
                  },
                }
              : undefined,
          },
          {
            role: 'user',
            content: options.userPrompt,
          },
        ],
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens,
      });

      return {
        text: result.text,
        model: modelId,
        promptTokensEstimate: countPromptTokens(options.systemPrompt + options.userPrompt),
        completionTokensEstimate: countPromptTokens(result.text),
        prefixCacheEnabled: enablePrefixCache,
      };
    }
  );
}
