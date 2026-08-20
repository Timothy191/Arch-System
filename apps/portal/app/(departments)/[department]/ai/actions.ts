"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { createTrackedGoogleAI } from "@/lib/ai/google-ai-client";
import { logError } from "@/lib/errors/error-logger";

/**
 * Server Action: Generate AI response with automatic token tracking
 * Example usage in components
 */
export async function generateAIResponseAction({
  prompt,
  model = "gemini-2.0-flash",
  context,
}: {
  prompt: string;
  model?: "gemini-2.0-flash" | "gemini-2.0-pro" | "gemini-1.5-flash";
  context?: {
    departmentId?: string;
    operationType?: string;
    metadata?: Record<string, any>;
  };
}) {
  try {
    const ai = createTrackedGoogleAI();

    const result = await ai.generateTextWithTracking(prompt, {
      modelName: model,
      departmentId: context?.departmentId,
      operationType: context?.operationType || "general",
      metadata: context?.metadata,
    });

    return {
      success: true,
      response: result.result.response.text(),
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), {
      context: "ai_actions",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI generation failed",
      tokenUsage: null,
    };
  }
}

/**
 * Server Action: Get AI token usage statistics
 */
export async function getAITokenUsageStats({
  startDate,
  endDate,
  departmentId,
}: {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
} = {}) {
  try {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("ai_token_usage")
      .select("*")
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate aggregates
    const totalTokens = data.reduce((sum, r) => sum + r.total_tokens, 0);
    const totalCostCents = data.reduce((sum, r) => sum + r.total_cost_usd_cents, 0);
    const totalRequests = data.length;
    const avgLatency = data.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / (totalRequests || 1);

    // Group by model
    const byModel = data.reduce(
      (acc, r) => {
        if (!acc[r.model_name]) {
          acc[r.model_name] = { tokens: 0, cost: 0, requests: 0 };
        }
        acc[r.model_name].tokens += r.total_tokens;
        acc[r.model_name].cost += r.total_cost_usd_cents;
        acc[r.model_name].requests++;
        return acc;
      },
      {} as Record<string, { tokens: number; cost: number; requests: number }>,
    );

    return {
      success: true,
      stats: {
        totalTokens,
        totalCostCents,
        totalRequests,
        avgLatency: Math.round(avgLatency),
        byModel,
        recentUsage: data.slice(0, 50),
      },
    };
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), {
      context: "ai_actions_stats",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch stats",
      stats: null,
    };
  }
}

/**
 * Server Action: Get daily AI token usage aggregation
 */
export async function getDailyAITokenUsage({
  days = 30,
  departmentId,
}: {
  days?: number;
  departmentId?: string;
} = {}) {
  try {
    const supabase = await createServerSupabaseClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase.rpc("get_ai_token_usage_daily", {
      start_date: startDate.toISOString(),
      dept_id: departmentId || null,
    });

    const { data, error } = await query;

    if (error) {
      // Fallback to manual aggregation if RPC doesn't exist yet
      const fallbackQuery = supabase
        .from("ai_token_usage")
        .select("created_at, model_name, total_tokens, total_cost_usd_cents")
        .gte("created_at", startDate.toISOString());

      if (departmentId) {
        fallbackQuery.eq("department_id", departmentId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw fallbackError;

      // Manual daily aggregation
      const dailyData: Record<
        string,
        { date: string; tokens: number; cost: number; requests: number }
      > = {};
      (fallbackData || []).forEach((r: any) => {
        const dateStr = new Date(r.created_at).toISOString().split("T")[0];
        if (dateStr) {
          if (!dailyData[dateStr]) {
            dailyData[dateStr] = { date: dateStr, tokens: 0, cost: 0, requests: 0 };
          }
          dailyData[dateStr].tokens += r.total_tokens || 0;
          dailyData[dateStr].cost += r.total_cost_usd_cents || 0;
          dailyData[dateStr].requests++;
        }
      });

      return {
        success: true,
        data: Object.values(dailyData).sort((a, b) => b.date.localeCompare(a.date)),
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), {
      context: "ai_actions_daily",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch daily usage",
      data: null,
    };
  }
}
