import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';

function createEmptyMetrics() {
  return {
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
    byModel: [] as Array<{
      name: string;
      tokens: number;
      cost: number;
      requests: number;
      cachedTokens: number;
      percentage: number;
    }>,
    recentUsage: [] as Array<{
      id: string;
      timestamp: string;
      model: string;
      tokens: number;
      costCents: number;
      latency: number;
      status: string;
    }>,
  };
}

function isSchemaOrTableUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err && typeof err.code === 'string' ? err.code : '';
  const message = 'message' in err && typeof err.message === 'string' ? err.message : '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42501' ||
    code.startsWith('PGRST') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

/**
 * GET /api/ai/metrics
 * Returns real-time AI token usage metrics for dashboard
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope') || 'session'; // 'session' | 'all-time' | '24h' | '7d' | '30d'
    const departmentId = searchParams.get('department_id');

    // Calculate date range
    const startDate = new Date();
    if (scope === 'session') {
      // Current session = today
      startDate.setHours(0, 0, 0, 0);
    } else if (scope === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (scope === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (scope === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      // all-time = no date filter
      startDate.setFullYear(2000, 0, 1);
    }

    // Build query
    let query = supabase
      .from('ai_token_usage')
      .select('*')
      .order('created_at', { ascending: false });

    if (scope !== 'all-time') {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data: usage, error } = await query;

    if (error) {
      if (isSchemaOrTableUnavailableError(error)) {
        return NextResponse.json({
          success: true,
          metrics: createEmptyMetrics(),
        });
      }
      throw error;
    }

    if (!usage || usage.length === 0) {
      return NextResponse.json({
        success: true,
        metrics: createEmptyMetrics(),
      });
    }

    // Calculate metrics
    const totalTokens = usage.reduce((sum, r) => sum + Number(r.total_tokens ?? 0), 0);
    const totalPromptTokens = usage.reduce((sum, r) => sum + Number(r.prompt_tokens ?? 0), 0);
    const totalCompletionTokens = usage.reduce(
      (sum, r) => sum + Number(r.completion_tokens ?? 0),
      0
    );
    const totalCachedTokens = usage.reduce(
      (sum, r) => sum + Number(r.cached_prompt_tokens ?? 0),
      0
    );
    const totalCostCents = usage.reduce((sum, r) => sum + Number(r.total_cost_usd_cents ?? 0), 0);
    const totalCostUSD = totalCostCents / 100;
    const totalCostZAR = totalCostUSD * 18.52; // ZAR exchange rate

    const cacheHitRatio =
      totalPromptTokens > 0
        ? Math.round((totalCachedTokens / totalPromptTokens) * 100 * 10) / 10
        : 0;

    const tokensSaved = totalCachedTokens * 0.75; // 75% savings from cache

    // Group by model
    const byModel: Record<
      string,
      { tokens: number; cost: number; requests: number; cachedTokens: number }
    > = {};
    usage.forEach((r) => {
      const modelName = (r.model_name as string) || 'unknown';
      if (!byModel[modelName]) {
        byModel[modelName] = {
          tokens: 0,
          cost: 0,
          requests: 0,
          cachedTokens: 0,
        };
      }
      byModel[modelName].tokens += Number(r.total_tokens ?? 0);
      byModel[modelName].cost += Number(r.total_cost_usd_cents ?? 0);
      byModel[modelName].requests++;
      byModel[modelName].cachedTokens += Number(r.cached_prompt_tokens ?? 0);
    });

    // Calculate percentage share for each model
    const modelBreakdown = Object.entries(byModel).map(([name, data]) => ({
      name,
      ...data,
      percentage: totalTokens > 0 ? Math.round((data.tokens / totalTokens) * 100 * 10) / 10 : 0,
    }));

    // Recent usage (last 20 requests)
    const recentUsage = usage.slice(0, 20).map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      model: r.model_name,
      tokens: Number(r.total_tokens ?? 0),
      costCents: Number(r.total_cost_usd_cents ?? 0),
      latency: Number(r.latency_ms ?? 0),
      status: r.status || 'success',
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
          usage.reduce((sum, r) => sum + Number(r.latency_ms ?? 0), 0) / (usage.length || 1)
        ),
        byModel: modelBreakdown,
        recentUsage,
      },
    });
  } catch (error) {
    await logError(error, { context: 'ai_metrics_route' });
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof error.message === 'string'
          ? error.message
          : 'Failed to fetch metrics';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
