/**
 * Google AI API Client with Token Tracking
 * Wraps Google's Generative AI SDK to automatically track token usage
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerSupabaseClient } from "@repo/supabase/server";
import type { GenerateContentRequest, GenerateContentResult } from "@google/generative-ai";

// Google AI pricing (as of 2026)
// Source: https://ai.google.dev/pricing
const PRICING = {
  // Gemini 2.0 Flash
  "gemini-2.0-flash": {
    prompt: 0.075, // $0.075 per 1M tokens (cache miss)
    promptCached: 0.01875, // $0.01875 per 1M tokens (cache hit - 75% discount)
    completion: 0.3, // $0.30 per 1M tokens
  },
  // Gemini 2.0 Pro
  "gemini-2.0-pro": {
    prompt: 1.25,
    promptCached: 0.3125,
    completion: 5.0,
  },
  // Gemini 1.5 Flash (legacy)
  "gemini-1.5-flash": {
    prompt: 0.075,
    promptCached: 0.01875,
    completion: 0.3,
  },
};

type ModelName = keyof typeof PRICING;

interface TokenUsageMetadata {
  requestId: string;
  userId?: string;
  departmentId?: string;
  endpointPath?: string;
  operationType?: string;
  metadata?: Record<string, any>;
}

interface TrackedGenerationResult {
  result: GenerateContentResult;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
    costUSD: number;
    costCents: number;
  };
}

/**
 * Calculate cost based on token usage and model pricing
 */
function calculateCost(
  modelName: ModelName,
  promptTokens: number,
  completionTokens: number,
  cachedPromptTokens: number,
): number {
  const pricing = PRICING[modelName] || PRICING["gemini-2.0-flash"];

  const uncachedPromptTokens = promptTokens - cachedPromptTokens;

  const promptCost = (uncachedPromptTokens / 1_000_000) * pricing.prompt;
  const cachedCost = (cachedPromptTokens / 1_000_000) * pricing.promptCached;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;

  return promptCost + cachedCost + completionCost;
}

/**
 * Record token usage to database
 */
async function recordTokenUsage(
  modelName: string,
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
    costCents: number;
  },
  metadata: TokenUsageMetadata,
  latencyMs: number,
  error?: string,
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { error: insertError } = await supabase.from("ai_token_usage").insert({
      request_id: metadata.requestId,
      user_id: metadata.userId,
      department_id: metadata.departmentId,
      model_name: modelName,
      model_provider: "google",
      prompt_tokens: tokenUsage.promptTokens,
      completion_tokens: tokenUsage.completionTokens,
      total_tokens: tokenUsage.totalTokens,
      cached_prompt_tokens: tokenUsage.cachedPromptTokens,
      prompt_cost_usd_cents: Math.round(tokenUsage.costCents * 0.3), // Approx 30% of total
      completion_cost_usd_cents: Math.round(tokenUsage.costCents * 0.7),
      total_cost_usd_cents: tokenUsage.costCents,
      endpoint_path: metadata.endpointPath,
      operation_type: metadata.operationType,
      status: error ? "error" : "success",
      error_message: error,
      latency_ms: latencyMs,
      metadata: metadata.metadata || {},
    });

    if (insertError) {
      console.error("Failed to record AI token usage:", insertError); // eslint-disable-line no-console
    }
  } catch (err) {
    console.error("Error recording token usage:", err); // eslint-disable-line no-console
  }
}

/**
 * Google AI Client wrapper with automatic token tracking
 */
export class TrackedGoogleAI {
  private client: GoogleGenerativeAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY || "";
    if (!this.apiKey) {
      console.warn("GOOGLE_AI_API_KEY not configured - AI features will be disabled"); // eslint-disable-line no-console
    }
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Generate content with automatic token tracking
   */
  async generateContentWithTracking(
    model: ModelName,
    request: string | GenerateContentRequest,
    tracking: Partial<TokenUsageMetadata>,
  ): Promise<TrackedGenerationResult> {
    const startTime = Date.now();
    const requestId = tracking.requestId || crypto.randomUUID();

    try {
      const genModel = this.client.getGenerativeModel({ model });
      const result = await genModel.generateContent(request);

      const latencyMs = Date.now() - startTime;

      // Extract token usage from response
      const usageMetadata = result.response.usageMetadata;
      const promptTokens = usageMetadata?.promptTokenCount || 0;
      const completionTokens = usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = usageMetadata?.totalTokenCount || 0;

      // Estimate cached tokens (Google doesn't expose this directly)
      // We estimate based on prompt length vs typical context
      const cachedPromptTokens = 0; // Would need prompt caching headers from Google

      const costUSD = calculateCost(model, promptTokens, completionTokens, cachedPromptTokens);
      const costCents = Math.round(costUSD * 100);

      // Record to database
      await recordTokenUsage(
        model,
        {
          promptTokens,
          completionTokens,
          totalTokens,
          cachedPromptTokens,
          costCents,
        },
        { ...tracking, requestId },
        latencyMs,
      );

      return {
        result,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens,
          cachedPromptTokens,
          costUSD,
          costCents,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record failed request
      await recordTokenUsage(
        model,
        {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cachedPromptTokens: 0,
          costCents: 0,
        },
        { ...tracking, requestId },
        latencyMs,
        errorMessage,
      );

      throw error;
    }
  }

  /**
   * Get model instance for advanced usage
   */
  getModel(modelName: ModelName) {
    return this.client.getGenerativeModel({ model: modelName });
  }
}

/**
 * Create a new tracked Google AI client instance
 */
export function createTrackedGoogleAI() {
  return new TrackedGoogleAI();
}
