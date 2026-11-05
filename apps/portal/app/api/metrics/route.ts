/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Prometheus Metrics
 *     description: Exposes business telemetry and error metrics for Prometheus scraping.
 */

import { getCacheStats } from '@repo/redis';
import { registry } from '@repo/utils/observability/metrics';
import { NextResponse } from 'next/server';
import { getObservabilityMetrics } from '@/lib/observability/simple-metrics';

function escapeLabelValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function labelValue(value: string | number): string {
  return `"${escapeLabelValue(String(value))}"`;
}

export async function GET() {
  const [cacheStats, observability] = await Promise.all([
    getCacheStats().catch(() => ({
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      redisErrors: 1,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      xFetchTriggers: 0,
    })),
    getObservabilityMetrics(),
  ]);
  const { jobMetrics, dbMetrics } = observability;
  let body = '';

  // 1. Cache Metrics
  body += `# HELP portal_cache_hits_total Cumulative number of cache hits.
# TYPE portal_cache_hits_total counter
portal_cache_hits_total{source="l1"} ${cacheStats.l1Hits}
portal_cache_hits_total{source="l2"} ${cacheStats.l2Hits}

# HELP portal_cache_misses_total Cumulative number of cache misses.
# TYPE portal_cache_misses_total counter
portal_cache_misses_total ${cacheStats.misses}

# HELP portal_cache_errors_total Cumulative number of Redis cache errors.
# TYPE portal_cache_errors_total counter
portal_cache_errors_total ${cacheStats.redisErrors}

# HELP portal_cache_latency_ms Average latency of cache accesses in milliseconds.
# TYPE portal_cache_latency_ms gauge
portal_cache_latency_ms{metric="avg"} ${cacheStats.avgLatencyMs}
portal_cache_latency_ms{metric="p95"} ${cacheStats.p95LatencyMs}

# HELP portal_cache_xfetch_triggers_total Cumulative X-Fetch probabilistic early expirations.
# TYPE portal_cache_xfetch_triggers_total counter
portal_cache_xfetch_triggers_total ${cacheStats.xFetchTriggers ?? 0}

`;
  // 2. Inngest Job Metrics
  body += `# HELP portal_inngest_job_executions_total Total number of Inngest job executions.
# TYPE portal_inngest_job_executions_total counter
`;
  for (const [jobId, entry] of jobMetrics.entries()) {
    body += `portal_inngest_job_executions_total{job_id=${labelValue(jobId)}} ${entry.count}\n`;
  }
  body += `\n`;

  body += `# HELP portal_inngest_job_errors_total Total number of Inngest job execution errors.
# TYPE portal_inngest_job_errors_total counter
`;
  for (const [jobId, entry] of jobMetrics.entries()) {
    body += `portal_inngest_job_errors_total{job_id=${labelValue(jobId)}} ${entry.errors}\n`;
  }
  body += `\n`;

  body += `# HELP portal_inngest_job_duration_ms_total Cumulative duration of Inngest job executions in milliseconds.
# TYPE portal_inngest_job_duration_ms_total counter
`;
  for (const [jobId, entry] of jobMetrics.entries()) {
    body += `portal_inngest_job_duration_ms_total{job_id=${labelValue(jobId)}} ${Math.round(entry.totalDurationMs * 100) / 100}\n`;
  }
  body += `\n`;

  // 3. Database Query Metrics
  body += `# HELP portal_db_query_executions_total Total number of database query executions.
# TYPE portal_db_query_executions_total counter
`;
  for (const [key, entry] of dbMetrics.entries()) {
    const [tableName = '', operation = 'unknown'] = key.split(':');
    body += `portal_db_query_executions_total{table=${labelValue(tableName)},operation=${labelValue(operation)}} ${entry.count}\n`;
  }
  body += `\n`;

  body += `# HELP portal_db_query_errors_total Total number of database query errors.
# TYPE portal_db_query_errors_total counter
`;
  for (const [key, entry] of dbMetrics.entries()) {
    const [tableName = '', operation = 'unknown'] = key.split(':');
    body += `portal_db_query_errors_total{table=${labelValue(tableName)},operation=${labelValue(operation)}} ${entry.errors}\n`;
  }
  body += `\n`;

  body += `# HELP portal_db_query_duration_ms_total Cumulative duration of database queries in milliseconds.
# TYPE portal_db_query_duration_ms_total counter
`;
  for (const [key, entry] of dbMetrics.entries()) {
    const [tableName = '', operation = 'unknown'] = key.split(':');
    body += `portal_db_query_duration_ms_total{table=${labelValue(tableName)},operation=${labelValue(operation)}} ${Math.round(entry.totalDurationMs * 100) / 100}\n`;
  }
  body += `\n`;

  // 4. Prometheus Registry Metrics (@repo/utils)
  const promMetrics = await registry.metrics();
  body += promMetrics;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
