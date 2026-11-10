import {
  DEGRADED_LATENCY_THRESHOLD_MS,
  FULL_SLA_PCT,
  getAllUptimeSummaries,
  getUptimeTargetSummary,
  MAX_HEARTBEAT_TICKS,
  recordHeartbeatTick,
  resetUptimeEngineState,
} from './uptime-engine';

const FAST_LATENCY_MS = 25;
const SLOW_LATENCY_MS = 650;
const FAILED_LATENCY_MS = -1;
const OVERFLOW_TICK_COUNT = 95;
const EXPECTED_MIXED_SLA_PCT = 50;
const EXPECTED_PARTIAL_SLA_PCT = 75;
const SAMPLE_LATENCIES_MS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 400,
] as const;
const EXPECTED_P95_LATENCY_MS = 190;
const EXPECTED_TARGET_COUNT = 4;

describe('Given the native Uptime Engine ring buffer and SLA calculator', () => {
  beforeEach(() => {
    resetUptimeEngineState();
  });

  it('When no ticks have been recorded, Then getUptimeTargetSummary defaults to 100% SLA and UP status', () => {
    const summary = getUptimeTargetSummary('redis');

    expect(summary.targetId).toBe('redis');
    expect(summary.currentStatus).toBe('UP');
    expect(summary.sla24hPct).toBe(FULL_SLA_PCT);
    expect(summary.sla7dPct).toBe(FULL_SLA_PCT);
    expect(summary.sla30dPct).toBe(FULL_SLA_PCT);
    expect(summary.p95LatencyMs).toBe(0);
    expect(summary.ticks).toHaveLength(0);
  });

  it('When recordHeartbeatTick is called without explicit status, Then it classifies UP, DEGRADED, and DOWN from latencyMs', () => {
    const upTick = recordHeartbeatTick({
      targetId: 'supabase',
      latencyMs: FAST_LATENCY_MS,
    });
    const degradedTick = recordHeartbeatTick({
      targetId: 'supabase',
      latencyMs: DEGRADED_LATENCY_THRESHOLD_MS,
    });
    const downTick = recordHeartbeatTick({
      targetId: 'supabase',
      latencyMs: FAILED_LATENCY_MS,
    });

    expect(upTick.status).toBe('UP');
    expect(degradedTick.status).toBe('DEGRADED');
    expect(downTick.status).toBe('DOWN');

    const summary = getUptimeTargetSummary('supabase');
    expect(summary.currentStatus).toBe('DOWN');
    expect(summary.sla24hPct).toBe(EXPECTED_MIXED_SLA_PCT);
  });

  it('When UP and DEGRADED ticks are recorded, Then SLA percentages weight DEGRADED at 0.5', () => {
    recordHeartbeatTick({
      targetId: 'fuxa_scada',
      latencyMs: FAST_LATENCY_MS,
    });
    recordHeartbeatTick({
      targetId: 'fuxa_scada',
      latencyMs: SLOW_LATENCY_MS,
    });

    const summary = getUptimeTargetSummary('fuxa_scada');
    expect(summary.sla24hPct).toBe(EXPECTED_PARTIAL_SLA_PCT);
    expect(summary.sla7dPct).toBe(EXPECTED_PARTIAL_SLA_PCT);
    expect(summary.sla30dPct).toBe(EXPECTED_PARTIAL_SLA_PCT);
  });

  it('When latency samples are recorded, Then p95LatencyMs reflects the 95th percentile', () => {
    for (const latencyMs of SAMPLE_LATENCIES_MS) {
      recordHeartbeatTick({
        targetId: 'portal_runtime',
        latencyMs,
      });
    }

    const summary = getUptimeTargetSummary('portal_runtime');
    expect(summary.p95LatencyMs).toBe(EXPECTED_P95_LATENCY_MS);
  });

  it('When more than 90 ticks are recorded for a target, Then the ring buffer caps at MAX_HEARTBEAT_TICKS', () => {
    for (let index = 1; index <= OVERFLOW_TICK_COUNT; index += 1) {
      recordHeartbeatTick({
        targetId: 'redis',
        latencyMs: index,
        checkedAt: `2026-11-10T12:00:${String(index % MAX_HEARTBEAT_TICKS).padStart(2, '0')}Z`,
      });
    }

    const summary = getUptimeTargetSummary('redis');
    expect(summary.ticks).toHaveLength(MAX_HEARTBEAT_TICKS);
    expect(summary.ticks[0]?.latencyMs).toBe(OVERFLOW_TICK_COUNT - MAX_HEARTBEAT_TICKS + 1);
    expect(summary.ticks[MAX_HEARTBEAT_TICKS - 1]?.latencyMs).toBe(OVERFLOW_TICK_COUNT);
  });

  it('When getAllUptimeSummaries and resetUptimeEngineState are called, Then target state is isolated and resettable', () => {
    recordHeartbeatTick({ targetId: 'redis', latencyMs: FAST_LATENCY_MS });
    recordHeartbeatTick({ targetId: 'supabase', latencyMs: SLOW_LATENCY_MS });

    const summaries = getAllUptimeSummaries();
    expect(summaries).toHaveLength(EXPECTED_TARGET_COUNT);

    resetUptimeEngineState('redis');
    expect(getUptimeTargetSummary('redis').ticks).toHaveLength(0);
    expect(getUptimeTargetSummary('supabase').ticks).toHaveLength(1);
  });
});
