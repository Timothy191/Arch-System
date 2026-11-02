import { z } from 'zod';

export const subsystemHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export type SubsystemHealthStatus = z.infer<typeof subsystemHealthStatusSchema>;

/**
 * System resource telemetry metrics.
 * Derived from System Informer / Process Hacker observability patterns.
 */
export const systemResourceMetricsSchema = z.object({
  cpuUsagePercent: z.number().min(0).max(100),
  memoryRssBytes: z.number().nonnegative(),
  memoryHeapUsedBytes: z.number().nonnegative(),
  memoryHeapTotalBytes: z.number().nonnegative(),
  eventLoopLagMs: z.number().nonnegative(),
  activeDatabaseConnections: z.number().int().nonnegative(),
  redisLatencyMs: z.number().nonnegative(),
});
export type SystemResourceMetrics = z.infer<typeof systemResourceMetricsSchema>;

export const subsystemComponentHealthSchema = z.object({
  name: z.string().min(1),
  status: subsystemHealthStatusSchema,
  latencyMs: z.number().nonnegative(),
  details: z.string().optional(),
});
export type SubsystemComponentHealth = z.infer<typeof subsystemComponentHealthSchema>;

/**
 * Comprehensive System Health & Diagnostics Report.
 */
export const systemHealthReportSchema = z.object({
  timestamp: z.string().datetime(),
  overallStatus: subsystemHealthStatusSchema,
  resources: systemResourceMetricsSchema,
  subsystems: z.array(subsystemComponentHealthSchema),
});
export type SystemHealthReport = z.infer<typeof systemHealthReportSchema>;
