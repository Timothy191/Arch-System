/**
 * Cost Tracker — token usage logging (no-cost local LLM).
 *
 * Per-request token usage is still logged to Supabase for observability,
 * but estimatedCostUsd is always 0 since calls hit local Ollama.
 *
 * `TokenUsage` is the shared type used by agent-graph.ts and agent-state.ts.
 */

import { createServerSupabaseClient } from "@repo/supabase/server";
import { DatabaseError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

export interface TokenUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}

interface UsageRecord {
  id: string;
  sessionId: string;
  userId: string;
  model: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
  estimatedCostUsd: number;
  createdAt: string;
}

/**
 * Track token usage to Supabase (non-blocking).
 * gracefully handles Supabase write failures.
 */
const PROVIDER_MODELS: Record<string, string> = {
  primary: "llama-3.1-8b-instant",
  secondary: "meta-llama/llama-3.1-8b-instruct",
};

export async function trackUsage(
  sessionId: string,
  userId: string,
  provider: string,
  usage: TokenUsage,
  meta: { role?: string; node?: string } = {},
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("ai_usage_logs").insert({
      session_id: sessionId,
      user_id: userId,
      provider,
      model: PROVIDER_MODELS[provider] ?? "local",
      prompt_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      estimated_cost_usd:
        ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)) * 0.000001,
      ...meta,
    });
  } catch (err) {
    // Usage tracking is non-critical; swallow errors silently
    if (err instanceof Error) {
      logError(err, { context: "track_usage", sessionId });
    }
  }
}

/**
 * Aggregate cost and tokens over a date range for a user.
 */
export async function getUsageSummary(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  totalCostUsd: number;
  totalTokens: number;
  requestCount: number;
}> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("estimated_cost_usd, total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error) {
    throw new DatabaseError(error.message, {
      operation: "select",
      table: "ai_usage_logs",
      context: { error: error.message },
    });
  }

  const rows = data ?? [];
  return {
    totalCostUsd: rows.reduce((sum, r) => sum + (r.estimated_cost_usd ?? 0), 0),
    totalTokens: rows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
    requestCount: rows.length,
  };
}

/**
 * Get formatted usage records for a session.
 */
export async function getSessionUsage(
  sessionId: string,
): Promise<UsageRecord[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("*")
      .eq("session_id", sessionId)
      .limit(100);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      model: row.model as string,
      inputTokens: row.prompt_tokens as number | undefined,
      outputTokens: row.completion_tokens as number | undefined,
      totalTokens: row.total_tokens as number | undefined,
      estimatedCostUsd: row.estimated_cost_usd as number,
      createdAt: row.created_at as string,
    }));
  } catch {
    return [];
  }
}
