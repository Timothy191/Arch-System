import {
  probeFuxaEndpoint,
  probeRedis,
  probeSupabase,
  resolveFuxaUrl,
  type ServiceHealthStatus,
} from './health-probes';
import { collectRealLayerRuntimeSnapshot } from './metrics';
import { type PersistSloSnapshotsResult, persistSloSnapshots } from './slo-store';
import {
  getAllUptimeSummaries,
  type HeartbeatStatus,
  recordHeartbeatTick,
  type UptimeTargetId,
  type UptimeTargetSummary,
} from './uptime-engine';

const HEARTBEAT_STATUS_MAP: Readonly<Record<ServiceHealthStatus, HeartbeatStatus>> = {
  healthy: 'UP',
  degraded: 'DEGRADED',
  unhealthy: 'DOWN',
};

export interface SloSnapshotResult {
  readonly recordedTargets: readonly UptimeTargetId[];
  readonly summaries: readonly UptimeTargetSummary[];
  readonly persistence: PersistSloSnapshotsResult;
}

/**
 * Active SLO snapshot used by the scheduled cron: probes reachable services,
 * appends heartbeat ticks, computes SLA/SLO summaries, and persists them to
 * `slo_metrics`. Unlike the admin route's passive sampling, this is the only
 * path that records real Supabase/Redis/FUXA probe latency.
 */
export async function captureAndPersistSloSnapshot(): Promise<SloSnapshotResult> {
  const checkedAt = new Date().toISOString();
  const fuxaUrl = resolveFuxaUrl();
  const [supabaseResult, redisResult, fuxaProbeResult] = await Promise.all([
    probeSupabase(),
    probeRedis(),
    fuxaUrl ? probeFuxaEndpoint(fuxaUrl) : Promise.resolve(null),
  ]);

  const recordedTargets: UptimeTargetId[] = ['supabase', 'redis', 'portal_runtime'];
  recordHeartbeatTick({
    targetId: 'supabase',
    status: HEARTBEAT_STATUS_MAP[supabaseResult.status],
    latencyMs: supabaseResult.latencyMs,
    checkedAt,
  });
  recordHeartbeatTick({
    targetId: 'redis',
    status: HEARTBEAT_STATUS_MAP[redisResult.status],
    latencyMs: redisResult.latencyMs,
    checkedAt,
  });
  recordHeartbeatTick({
    targetId: 'portal_runtime',
    latencyMs: collectRealLayerRuntimeSnapshot().eventLoopDelayP95Ms,
    checkedAt,
  });

  if (fuxaProbeResult) {
    recordedTargets.push('fuxa_scada');
    recordHeartbeatTick({
      targetId: 'fuxa_scada',
      status: HEARTBEAT_STATUS_MAP[fuxaProbeResult.status],
      latencyMs: fuxaProbeResult.latencyMs,
      checkedAt,
    });
  }

  const summaries = getAllUptimeSummaries();
  const persistence = await persistSloSnapshots({ summaries });
  return { recordedTargets, summaries, persistence };
}
