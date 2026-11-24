/**
 * @jest-environment node
 */

import { collectRedisHealthDiagnostics, getCacheStats } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { resetAlertEvaluatorState } from '@/lib/observability/alert-evaluator';
import { clearObservabilityMetrics, recordJobExecution } from '@/lib/observability/simple-metrics';
import { resetUptimeEngineState } from '@/lib/observability/uptime-engine';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  getCacheStats: jest.fn(),
  collectRedisHealthDiagnostics: jest.fn(),
}));

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);
const mockGetCacheStats = jest.mocked(getCacheStats);
const mockCollectRedisHealthDiagnostics = jest.mocked(collectRedisHealthDiagnostics);

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const MOCK_HITS = 420;
const MOCK_MISSES = 18;
const MOCK_L1_HITS = 300;
const MOCK_L2_HITS = 120;
const MOCK_AVG_LATENCY_MS = 4.2;
const MOCK_P95_LATENCY_MS = 12.8;
const MOCK_USED_MEMORY_BYTES = 16_777_216;
const MOCK_HIT_RATE_RATIO = 0.9589;
const MOCK_JOB_DURATION_MS = 145;
const EXPECTED_UPTIME_TARGETS = 4;
const EXPECTED_ALERT_COUNT = 4;
const EXPECTED_GOLDEN_SIGNAL_COUNT = 4;
const EXPECTED_FULL_SLA_PCT = 100;

describe('Given GET /api/admin/observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetUptimeEngineState();
    resetAlertEvaluatorState();
    clearObservabilityMetrics();
  });

  it('When the caller is unauthenticated, Then it returns 401 Unauthorized', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
    expect(payload).toEqual({ error: 'Unauthorized' });
  });

  it('When the caller is authenticated, Then it returns 200 with uptime, alerts, redis, runtime, workflows, and Server-Timing header', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      id: 'emp-admin-01',
      role: 'admin',
      departmentId: null,
      accessibleDepartments: [],
    } as unknown as Awaited<ReturnType<typeof getAuthenticatedEmployee>>);

    mockGetCacheStats.mockResolvedValueOnce({
      hits: MOCK_HITS,
      misses: MOCK_MISSES,
      l1Hits: MOCK_L1_HITS,
      l2Hits: MOCK_L2_HITS,
      redisErrors: 0,
      avgLatencyMs: MOCK_AVG_LATENCY_MS,
      p95LatencyMs: MOCK_P95_LATENCY_MS,
      xFetchTriggers: 0,
      l1Evictions: 0,
      l2RoundTrips: MOCK_L2_HITS,
      privilegeVersionChanges: 0,
      avgWriteThroughDelayMs: 0,
    });

    mockCollectRedisHealthDiagnostics.mockResolvedValueOnce({
      usedMemoryBytes: MOCK_USED_MEMORY_BYTES,
      usedMemoryRssBytes: MOCK_USED_MEMORY_BYTES,
      usedMemoryDatasetBytes: MOCK_USED_MEMORY_BYTES,
      memFragmentationRatio: 1,
      maxmemoryBytes: 0,
      maxmemoryPolicy: 'volatile-lru',
      evictedKeysTotal: 0,
      keyspaceHitsTotal: MOCK_HITS,
      keyspaceMissesTotal: MOCK_MISSES,
      hitRateRatio: MOCK_HIT_RATE_RATIO,
      replicationRole: 'master',
      connectedSlaves: 0,
      masterReplOffset: 0,
      slowlogCount: 0,
    });

    recordJobExecution('shift-closeout-sync', MOCK_JOB_DURATION_MS, true);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(HTTP_OK);
    expect(response.headers.get('Server-Timing')).toContain('cache;dur=');
    expect(payload.overallSla24hPct).toBe(EXPECTED_FULL_SLA_PCT);
    expect(payload.uptime).toHaveLength(EXPECTED_UPTIME_TARGETS);
    expect(payload.uptimeByTarget.redis.targetId).toBe('redis');
    expect(payload.goldenSignals).toHaveLength(EXPECTED_GOLDEN_SIGNAL_COUNT);
    expect(payload.alerts).toHaveLength(EXPECTED_ALERT_COUNT);
    expect(payload.redis.stats.hits).toBe(MOCK_HITS);
    expect(payload.redis.diagnostics?.usedMemoryBytes).toBe(MOCK_USED_MEMORY_BYTES);
    expect(payload.runtime.v8HeapUsedBytes).toBeGreaterThan(0);
    expect(payload.workflows).toEqual([
      {
        jobId: 'shift-closeout-sync',
        count: 1,
        errors: 0,
        lastDurationMs: MOCK_JOB_DURATION_MS,
      },
    ]);
  });

  it('When the caller is authenticated without admin role, Then it returns 403 Forbidden', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      id: 'emp-op-01',
      role: 'operator',
      departmentId: null,
      accessibleDepartments: [],
    } as unknown as Awaited<ReturnType<typeof getAuthenticatedEmployee>>);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(HTTP_FORBIDDEN);
    expect(payload).toEqual({ error: 'Forbidden' });
  });

  it('When an admin exceeds 60 req/min, Then it returns 429 Too Many Requests', async () => {
    mockGetCacheStats.mockResolvedValue({
      hits: MOCK_HITS,
      misses: MOCK_MISSES,
      l1Hits: MOCK_L1_HITS,
      l2Hits: MOCK_L2_HITS,
      redisErrors: 0,
      avgLatencyMs: MOCK_AVG_LATENCY_MS,
      p95LatencyMs: MOCK_P95_LATENCY_MS,
      xFetchTriggers: 0,
      l1Evictions: 0,
      l2RoundTrips: MOCK_L2_HITS,
      privilegeVersionChanges: 0,
      avgWriteThroughDelayMs: 0,
    });
    mockCollectRedisHealthDiagnostics.mockResolvedValue(null);

    for (let i = 0; i < 60; i += 1) {
      mockGetAuthenticatedEmployee.mockResolvedValueOnce({
        id: 'emp-admin-rate-limit',
        role: 'admin',
        departmentId: null,
        accessibleDepartments: [],
      } as unknown as Awaited<ReturnType<typeof getAuthenticatedEmployee>>);
      const okRes = await GET();
      expect(okRes.status).toBe(HTTP_OK);
    }

    mockGetAuthenticatedEmployee.mockResolvedValueOnce({
      id: 'emp-admin-rate-limit',
      role: 'admin',
      departmentId: null,
      accessibleDepartments: [],
    } as unknown as Awaited<ReturnType<typeof getAuthenticatedEmployee>>);
    const limitedRes = await GET();
    expect(limitedRes.status).toBe(HTTP_TOO_MANY_REQUESTS);
  });
});
