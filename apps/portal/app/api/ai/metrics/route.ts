import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { logError } from "@/lib/errors/error-logger";

/**
 * GET /api/ai/metrics
 * Returns real-time AI token usage metrics for dashboard
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    const scope = searchParams.get("scope") || "session"; // 'session' | 'all-time' | '24h' | '7d' | '30d'
    const departmentId = searchParams.get("department_id");

    // Calculate date range
    const startDate = new Date();
    if (scope === "session") {
      // Current session = today
      startDate.setHours(0, 0, 0, 0);
    } else if (scope === "24h") {
      startDate.setHours(startDate.getHours() - 24);
    } else if (scope === "7d") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (scope === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      // all-time = no date filter
      startDate.setFullYear(2000, 0, 1);
    }

    // Build query
    let query = supabase
      .from("ai_token_usage")
      .select("*")
      .order("created_at", { ascending: false });

    if (scope !== "all-time") {
      query = query.gte("created_at", startDate.toISOString());
    }
    
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    const { data: usage, error } = await query;

    if (error) throw error;

    if (!usage) {
      return NextResponse.json({
        success: true,
        metrics: {
          totalTokens: 0,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalCachedTokens: 0,
          cacheHitRatio: 0,
          tokensSaved: 0,
          totalCostUSD: 0,
          totalCostZAR: 0,
          totalRequests: 0,
          avgLatency: 0,
          byModel: [],
          recentUsage: [],
        },
      });
    }

    // Calculate metrics
    const totalTokens = usage.reduce((sum, r) => sum + r.total_tokens, 0);
    const totalPromptTokens = usage.reduce((sum, r) => sum + r.prompt_tokens, 0);
    const totalCompletionTokens = usage.reduce((sum, r) => sum + r.completion_tokens, 0);
    const totalCachedTokens = usage.reduce((sum, r) => sum + r.cached_prompt_tokens, 0);
    const totalCostCents = usage.reduce((sum, r) => sum + r.total_cost_usd_cents, 0);
    const totalCostUSD = totalCostCents / 100;
    const totalCostZAR = totalCostUSD * 18.52; // ZAR exchange rate
    
    const cacheHitRatio = totalPromptTokens > 0 
      ? Math.round((totalCachedTokens / totalPromptTokens) * 100 * 10) / 10
      : 0;

    const tokensSaved = totalCachedTokens * 0.75; // 75% savings from cache

    // Group by model
    const byModel: Record<string, { tokens: number; cost: number; requests: number; cachedTokens: number }> = {};
    usage.forEach(r => {
      const modelName = r.model_name as string;
      if (!byModel[modelName]) {
        byModel[modelName] = {
          tokens: 0,
          cost: 0,
          requests: 0,
          cachedTokens: 0,
        };
      }
      byModel[modelName].tokens += r.total_tokens;
      byModel[modelName].cost += r.total_cost_usd_cents;
      byModel[modelName].requests++;
      byModel[modelName].cachedTokens += r.cached_prompt_tokens;
    });

    // Calculate percentage share for each model
    const modelBreakdown = Object.entries(byModel).map(([name, data]) => ({
      name,
      ...data,
      percentage: Math.round((data.tokens / totalTokens) * 100 * 10) / 10,
    }));

    // Recent usage (last 20 requests)
    const recentUsage = usage.slice(0, 20).map(r => ({
      id: r.id,
      timestamp: r.created_at,
      model: r.model_name,
      tokens: r.total_tokens,
      costCents: r.total_cost_usd_cents,
      latency: r.latency_ms || 0,
      status: r.status,
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCachedTokens,
        cacheHitRatio,
        tokensSaved,
        totalCostUSD,
        totalCostZAR,
        totalRequests: usage.length,
        avgLatency: Math.round(
          usage.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / (usage.length || 1)
        ),
        byModel: modelBreakdown,
        recentUsage,
      },
    });
  } catch (error) {
    await logError(error instanceof Error ? error : new Error(String(error)), { context: "ai_metrics_route" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch metrics",
      },
      { status: 500 }
    );
  }
}
