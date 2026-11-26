import { aiMetricsQuerySchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import type { BuildTelemetrySummary } from '@/lib/ai-metrics-types';
import { logError } from '@/lib/errors/error-logger';

const aiMetricsLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: 60,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:ai_metrics:',
});

export type { BuildTelemetrySummary };

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;
const USD_TO_ZAR = 18.52;
const CENTS_PER_DOLLAR = 100;
const PERCENT_SCALE = 100;
const TENTHS_ROUNDING = 10;
const CACHE_TOKEN_SAVINGS_FACTOR = 0.75;
const DEFAULT_USAGE_LIMIT = 500;
const MAX_USAGE_LIMIT = 1000;
const MAX_RECENT_USAGE_ROWS = 20;
const HOURS_24 = 24;
const DAYS_7 = 7;
const DAYS_30 = 30;
const ALLOWED_SCOPES = new Set(['session', '24h', '7d', '30d', 'all-time']);

export interface RuntimeRedisCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly l1Hits: number;
  readonly l2Hits: number;
  readonly xFetchTriggers: number;
  readonly redisErrors: number;
  readonly hitRatePct: number | null;
  readonly missRatePct: number | null;
  readonly avgLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
}

export interface RuntimeSubsystemHealth {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs: number | null;
  readonly detail: string;
}

export interface RuntimeSystemHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly subsystems: readonly RuntimeSubsystemHealth[];
}

export interface AIMetricsPagination {
  readonly limit: number;
  readonly offset: number;
  readonly returnedRows: number;
  readonly totalCount: number | null;
  readonly hasMore: boolean;
}

interface CollectTelemetryHealthInput {
  readonly dbStatus: 'healthy' | 'degraded' | 'unhealthy';
  readonly dbLatencyMs: number;
  readonly dbDetail: string;
}

async function collectLiveRuntimeHealth(
  input: CollectTelemetryHealthInput
): Promise<{ redisCacheStats: RuntimeRedisCacheStats; systemHealth: RuntimeSystemHealth }> {
  let hits = 0;
  let misses = 0;
  let l1Hits = 0;
  let l2Hits = 0;
  let xFetchTriggers = 0;
  let redisErrors = 0;
  let avgLatencyMs: number | null = null;
  let p95LatencyMs: number | null = null;
  let redisReachable = false;

  try {
    const liveStats = await getCacheStats();
    if (liveStats) {
      redisReachable = true;
      hits = liveStats.hits ?? 0;
      misses = liveStats.misses ?? 0;
      l1Hits = liveStats.l1Hits ?? 0;
      l2Hits = liveStats.l2Hits ?? 0;
      xFetchTriggers = liveStats.xFetchTriggers ?? 0;
      redisErrors = liveStats.redisErrors ?? 0;
      avgLatencyMs = typeof liveStats.avgLatencyMs === 'number' ? liveStats.avgLatencyMs : null;
      p95LatencyMs = typeof liveStats.p95LatencyMs === 'number' ? liveStats.p95LatencyMs : null;
    }
  } catch {
    redisReachable = false;
  }

  const totalCacheOps = hits + misses;
  const hitRatePct =
    totalCacheOps > 0
      ? Math.round((hits / totalCacheOps) * PERCENT_SCALE * TENTHS_ROUNDING) / TENTHS_ROUNDING
      : null;
  const missRatePct =
    hitRatePct !== null
      ? Math.round((PERCENT_SCALE - hitRatePct) * TENTHS_ROUNDING) / TENTHS_ROUNDING
      : null;

  const redisStatus: 'healthy' | 'degraded' =
    redisReachable && redisErrors === 0 ? 'healthy' : 'degraded';

  const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
    input.dbStatus === 'unhealthy'
      ? 'unhealthy'
      : input.dbStatus === 'degraded' || redisStatus === 'degraded'
        ? 'degraded'
        : 'healthy';

  return {
    redisCacheStats: {
      hits,
      misses,
      l1Hits,
      l2Hits,
      xFetchTriggers,
      redisErrors,
      hitRatePct,
      missRatePct,
      avgLatencyMs,
      p95LatencyMs,
    },
    systemHealth: {
      status: overallStatus,
      subsystems: [
        {
          name: 'Supabase PostgreSQL (ai_token_usage)',
          status: input.dbStatus,
          latencyMs: input.dbLatencyMs,
          detail: input.dbDetail,
        },
        {
          name: 'Hybrid L1/L2 Redis Cache',
          status: redisStatus,
          latencyMs: avgLatencyMs,
          detail: redisReachable
            ? `${hits} hits • ${misses} misses • ${redisErrors} errors`
            : 'Cache stats unavailable',
        },
      ],
    },
  };
}

function parseBoundedInt(
  rawParam: string | null,
  bounds: { readonly fallback: number; readonly min: number; readonly max: number }
): number {
  if (!rawParam) return bounds.fallback;
  const parsed = Number.parseInt(rawParam, 10);
  if (!Number.isFinite(parsed)) return bounds.fallback;
  return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

function resolveScopeStartDate(scope: string): Date | null {
  if (scope === 'all-time') return null;
  const startDate = new Date();
  if (scope === 'session') {
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  }
  if (scope === '24h') {
    startDate.setHours(startDate.getHours() - HOURS_24);
    return startDate;
  }
  if (scope === '7d') {
    startDate.setDate(startDate.getDate() - DAYS_7);
    return startDate;
  }
  if (scope === '30d') {
    startDate.setDate(startDate.getDate() - DAYS_30);
    return startDate;
  }
  startDate.setHours(0, 0, 0, 0);
  return startDate;
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

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    return err.message;
  }
  return 'Failed to fetch metrics';
}

async function createZeroedMetrics(options: {
  readonly scope: string;
  readonly limit: number;
  readonly offset: number;
  readonly dbStatus: 'healthy' | 'degraded' | 'unhealthy';
  readonly dbLatencyMs: number;
  readonly dbDetail: string;
  readonly dbError?: string | null;
}) {
  const { redisCacheStats, systemHealth } = await collectLiveRuntimeHealth({
    dbStatus: options.dbStatus,
    dbLatencyMs: options.dbLatencyMs,
    dbDetail: options.dbDetail,
  });

  return {
    scope: options.scope,
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
    pagination: {
      limit: options.limit,
      offset: options.offset,
      returnedRows: 0,
      totalCount: options.dbStatus === 'healthy' ? 0 : null,
      hasMore: false,
    } satisfies AIMetricsPagination,
    redisCacheStats,
    systemHealth,
    dbError: options.dbError ?? null,
  };
}

/**
 * GET /api/ai/metrics
 * Admin-only endpoint returning live AI token usage metrics from public.ai_token_usage.
 */
export async function GET(request: Request) {
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: HTTP_UNAUTHORIZED }
    );
  }

  const role = String(principal.employee.role ?? '').toLowerCase();
  if (role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: HTTP_FORBIDDEN });
  }

  const rateLimit = await aiMetricsLimiter.check(principal.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const requestedScope = searchParams.get('scope') ?? searchParams.get('range') ?? 'session';
  const scope = ALLOWED_SCOPES.has(requestedScope) ? requestedScope : 'session';
  const parsedQuery = aiMetricsQuerySchema.safeParse({
    range: scope,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
    department: searchParams.get('department_id') ?? undefined,
  });
  const departmentId = parsedQuery.success
    ? (parsedQuery.data.department ?? null)
    : searchParams.get('department_id');
  const limit = parseBoundedInt(searchParams.get('limit'), {
    fallback: DEFAULT_USAGE_LIMIT,
    min: 1,
    max: MAX_USAGE_LIMIT,
  });
  const offset = parseBoundedInt(searchParams.get('offset'), {
    fallback: 0,
    min: 0,
    max: 100_000,
  });

  const queryStartedMs = Date.now();

  try {
    const supabase = await createServerSupabaseClient();
    const startDate = resolveScopeStartDate(scope);

    let query = supabase
      .from('ai_token_usage')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const queryWithBounds = query as typeof query & {
      range?: (from: number, to: number) => typeof query;
      limit?: (maxRows: number) => typeof query;
    };
    if (typeof queryWithBounds.range === 'function') {
      query = queryWithBounds.range(offset, offset + limit - 1);
    } else if (typeof queryWithBounds.limit === 'function') {
      query = queryWithBounds.limit(limit);
    }

    const { data: usage, error, count } = await query;
    const dbLatencyMs = Math.max(0, Date.now() - queryStartedMs);

    if (error) {
      if (isSchemaOrTableUnavailableError(error)) {
        const errorDetail = extractErrorMessage(error);
        return NextResponse.json(
          {
            success: true,
            metrics: await createZeroedMetrics({
              scope,
              limit,
              offset,
              dbStatus: 'degraded',
              dbLatencyMs,
              dbDetail: `Table unavailable: ${errorDetail}`,
              dbError: errorDetail,
            }),
          },
          {
            status: HTTP_OK,
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
          }
        );
      }
      throw error;
    }

    if (!usage || usage.length === 0) {
      return NextResponse.json(
        {
          success: true,
          metrics: await createZeroedMetrics({
            scope,
            limit,
            offset,
            dbStatus: 'healthy',
            dbLatencyMs,
            dbDetail: `0 usage rows in ${scope} window`,
          }),
        },
        {
          status: HTTP_OK,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    const totalTokens = usage.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0);
    const totalPromptTokens = usage.reduce((sum, row) => sum + Number(row.prompt_tokens ?? 0), 0);
    const totalCompletionTokens = usage.reduce(
      (sum, row) => sum + Number(row.completion_tokens ?? 0),
      0
    );
    const totalCachedTokens = usage.reduce(
      (sum, row) => sum + Number(row.cached_prompt_tokens ?? 0),
      0
    );
    const totalCostCents = usage.reduce(
      (sum, row) => sum + Number(row.total_cost_usd_cents ?? 0),
      0
    );
    const totalCostUSD = totalCostCents / CENTS_PER_DOLLAR;

    const cacheHitRatio =
      totalPromptTokens > 0
        ? Math.round((totalCachedTokens / totalPromptTokens) * PERCENT_SCALE * TENTHS_ROUNDING) /
          TENTHS_ROUNDING
        : 0;

    const tokensSaved = totalCachedTokens * CACHE_TOKEN_SAVINGS_FACTOR;

    const byModel: Record<
      string,
      { tokens: number; cost: number; requests: number; cachedTokens: number }
    > = {};
    for (const row of usage) {
      const modelName = (row.model_name as string) || 'unknown';
      const existing = byModel[modelName] ?? {
        tokens: 0,
        cost: 0,
        requests: 0,
        cachedTokens: 0,
      };
      existing.tokens += Number(row.total_tokens ?? 0);
      existing.cost += Number(row.total_cost_usd_cents ?? 0);
      existing.requests += 1;
      existing.cachedTokens += Number(row.cached_prompt_tokens ?? 0);
      byModel[modelName] = existing;
    }

    const modelBreakdown = Object.entries(byModel).map(([name, modelStats]) => ({
      name,
      ...modelStats,
      percentage:
        totalTokens > 0
          ? Math.round((modelStats.tokens / totalTokens) * PERCENT_SCALE * TENTHS_ROUNDING) /
            TENTHS_ROUNDING
          : 0,
    }));

    const recentUsage = usage.slice(0, MAX_RECENT_USAGE_ROWS).map((row) => ({
      id: row.id,
      timestamp: row.created_at ?? '',
      model: row.model_name,
      tokens: Number(row.total_tokens ?? 0),
      costCents: Number(row.total_cost_usd_cents ?? 0),
      latency: Number(row.latency_ms ?? 0),
      status: row.status || 'success',
    }));

    const resolvedTotalCount = typeof count === 'number' ? count : usage.length;
    interface AiTokenUsageSummaryRpc {
      total_requests?: number;
      total_tokens?: number;
      total_prompt_tokens?: number;
      total_completion_tokens?: number;
      total_cost_usd_cents?: number;
      avg_latency_ms?: number;
      by_model?: Array<{
        model_name: string;
        requests: number;
        tokens: number;
        cost_usd_cents: number;
        avg_latency_ms: number;
      }>;
    }

    const fetchWindowSummary = async (): Promise<AiTokenUsageSummaryRpc | null> => {
      if (departmentId || typeof (supabase as { rpc?: unknown }).rpc !== 'function') {
        return null;
      }
      try {
        const { data: rpcSummary, error: rpcError } = await supabase.rpc(
          'get_ai_token_usage_summary',
          { p_since: startDate ? startDate.toISOString() : null }
        );
        if (!rpcError && rpcSummary && typeof rpcSummary === 'object') {
          return rpcSummary as AiTokenUsageSummaryRpc;
        }
      } catch {
        // Fall back to row-level aggregation if RPC is unavailable
      }
      return null;
    };

    const windowSummary = await fetchWindowSummary();

    const effectiveTotalTokens =
      windowSummary?.total_tokens !== undefined ? Number(windowSummary.total_tokens) : totalTokens;
    const effectivePromptTokens =
      windowSummary?.total_prompt_tokens !== undefined
        ? Number(windowSummary.total_prompt_tokens)
        : totalPromptTokens;
    const effectiveCompletionTokens =
      windowSummary?.total_completion_tokens !== undefined
        ? Number(windowSummary.total_completion_tokens)
        : totalCompletionTokens;
    const effectiveCostUSD =
      windowSummary?.total_cost_usd_cents !== undefined
        ? Number(windowSummary.total_cost_usd_cents) / CENTS_PER_DOLLAR
        : totalCostUSD;
    const effectiveCostZAR =
      Math.round(effectiveCostUSD * USD_TO_ZAR * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR;
    const effectiveTotalRequests =
      windowSummary?.total_requests !== undefined
        ? Number(windowSummary.total_requests)
        : usage.length;
    const effectiveAvgLatency =
      windowSummary?.avg_latency_ms !== undefined
        ? Number(windowSummary.avg_latency_ms)
        : Math.round(
            usage.reduce((sum, row) => sum + Number(row.latency_ms ?? 0), 0) / usage.length
          );
    const effectiveByModel =
      Array.isArray(windowSummary?.by_model) && windowSummary.by_model.length > 0
        ? windowSummary.by_model.map((entry) => {
            const costUSD = Number(entry.cost_usd_cents ?? 0) / CENTS_PER_DOLLAR;
            return {
              model: entry.model_name,
              requests: Number(entry.requests ?? 0),
              tokens: Number(entry.tokens ?? 0),
              costUSD,
              costZAR: Math.round(costUSD * USD_TO_ZAR * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR,
              avgLatency: Number(entry.avg_latency_ms ?? 0),
            };
          })
        : modelBreakdown;

    const { redisCacheStats, systemHealth } = await collectLiveRuntimeHealth({
      dbStatus: 'healthy',
      dbLatencyMs,
      dbDetail: `${usage.length} row(s) queried (${scope})`,
    });

    return NextResponse.json(
      {
        success: true,
        metrics: {
          scope,
          totalTokens: effectiveTotalTokens,
          totalPromptTokens: effectivePromptTokens,
          totalCompletionTokens: effectiveCompletionTokens,
          totalCachedTokens,
          cacheHitRatio,
          tokensSaved,
          totalCostUSD: effectiveCostUSD,
          totalCostZAR: effectiveCostZAR,
          totalRequests: effectiveTotalRequests,
          avgLatency: effectiveAvgLatency,
          byModel: effectiveByModel,
          recentUsage,
          pagination: {
            limit,
            offset,
            returnedRows: usage.length,
            totalCount: resolvedTotalCount,
            hasMore: offset + usage.length < resolvedTotalCount,
          } satisfies AIMetricsPagination,
          redisCacheStats,
          systemHealth,
          dbError: null,
        },
      },
      {
        status: HTTP_OK,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    const dbLatencyMs = Math.max(0, Date.now() - queryStartedMs);
    await logError(error, { context: 'ai_metrics_route' });

    const { systemHealth } = await collectLiveRuntimeHealth({
      dbStatus: 'unhealthy',
      dbLatencyMs,
      dbDetail: 'Database query failed',
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load AI metrics',
        systemHealth,
      },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
