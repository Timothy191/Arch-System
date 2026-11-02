import { systemHealthReportSchema, systemResourceMetricsSchema } from './system-health.schema';

describe('systemResourceMetricsSchema', () => {
  it('validates a complete system resource telemetry snapshot', () => {
    const metrics = {
      cpuUsagePercent: 24.5,
      memoryRssBytes: 154000000,
      memoryHeapUsedBytes: 85000000,
      memoryHeapTotalBytes: 120000000,
      eventLoopLagMs: 2.1,
      activeDatabaseConnections: 12,
      redisLatencyMs: 0.8,
    };

    const parsed = systemResourceMetricsSchema.safeParse(metrics);
    expect(parsed.success).toBe(true);
  });

  it('rejects cpu usage above 100 percent', () => {
    const invalidMetrics = {
      cpuUsagePercent: 125.0,
      memoryRssBytes: 154000000,
      memoryHeapUsedBytes: 85000000,
      memoryHeapTotalBytes: 120000000,
      eventLoopLagMs: 2.1,
      activeDatabaseConnections: 12,
      redisLatencyMs: 0.8,
    };

    const parsed = systemResourceMetricsSchema.safeParse(invalidMetrics);
    expect(parsed.success).toBe(false);
  });
});

describe('systemHealthReportSchema', () => {
  it('validates a complete health report', () => {
    const report = {
      timestamp: '2026-11-02T14:30:00.000Z',
      overallStatus: 'healthy',
      resources: {
        cpuUsagePercent: 15.2,
        memoryRssBytes: 110000000,
        memoryHeapUsedBytes: 60000000,
        memoryHeapTotalBytes: 90000000,
        eventLoopLagMs: 1.4,
        activeDatabaseConnections: 8,
        redisLatencyMs: 0.5,
      },
      subsystems: [
        {
          name: 'supabase-postgres',
          status: 'healthy',
          latencyMs: 12.4,
        },
        {
          name: 'redis-cache',
          status: 'healthy',
          latencyMs: 0.5,
        },
      ],
    };

    const parsed = systemHealthReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
  });
});
