import { createServiceRoleClient } from '@repo/supabase/service-role';
import {
  FULL_SLA_PCT,
  ROUNDING_FACTOR,
  type SloBudgetState,
  type UptimeTargetSummary,
  WINDOW_24H_MS,
} from './uptime-engine';

const SLO_TARGET_PCT = 99.9;
const SLO_SNAPSHOT_DEDUPE_MS = 10 * 60 * 1000;
const SLO_NAME_PREFIX = 'uptime:';

interface SloMetricInsertRow {
  readonly slo_name: string;
  readonly target_value: number;
  readonly actual_value: number;
  readonly status: 'success' | 'warning' | 'breached';
  readonly error_budget_remaining: number;
  readonly measurement_time: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly metadata: Record<string, string | number>;
}

const SLO_STATUS_MAP: Readonly<Record<SloBudgetState, 'success' | 'warning' | 'breached'>> = {
  HEALTHY: 'success',
  DEGRADED: 'warning',
  CRITICAL: 'breached',
};

export interface PersistSloSnapshotsInput {
  readonly summaries: readonly UptimeTargetSummary[];
  readonly measuredAtMs?: number;
}

export interface PersistSloSnapshotsResult {
  readonly attempted: number;
  readonly inserted: number;
  readonly error?: string;
}

function computeErrorBudgetRemainingPct(actualPct: number): number {
  const remaining =
    ((actualPct - SLO_TARGET_PCT) / (FULL_SLA_PCT - SLO_TARGET_PCT)) * ROUNDING_FACTOR;
  const clamped = Math.min(ROUNDING_FACTOR, Math.max(0, remaining));
  return Math.round(clamped * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

function buildSloRow(summary: UptimeTargetSummary, measuredAtMs: number): SloMetricInsertRow {
  const measuredAtIso = new Date(measuredAtMs).toISOString();
  return {
    slo_name: `${SLO_NAME_PREFIX}${summary.targetId}`,
    target_value: SLO_TARGET_PCT,
    actual_value: summary.sla24hPct,
    status: SLO_STATUS_MAP[summary.sloBudgetState],
    error_budget_remaining: computeErrorBudgetRemainingPct(summary.sla24hPct),
    measurement_time: measuredAtIso,
    period_start: new Date(measuredAtMs - WINDOW_24H_MS).toISOString(),
    period_end: measuredAtIso,
    metadata: {
      targetId: summary.targetId,
      label: summary.label,
      currentStatus: summary.currentStatus,
      p95LatencyMs: summary.p95LatencyMs,
      sla7dPct: summary.sla7dPct,
      sla30dPct: summary.sla30dPct,
    },
  };
}

async function findRecentlyMeasuredSloNames(
  sloNames: readonly string[],
  measuredAtMs: number
): Promise<ReadonlySet<string>> {
  const supabase = createServiceRoleClient();
  const cutoffIso = new Date(measuredAtMs - SLO_SNAPSHOT_DEDUPE_MS).toISOString();
  const { data, error } = await supabase
    .from('slo_metrics')
    .select('slo_name')
    .in('slo_name', [...sloNames])
    .gte('measurement_time', cutoffIso);

  if (error || !data) {
    return new Set<string>();
  }
  return new Set(data.map((row) => String((row as { slo_name: string }).slo_name)));
}

/**
 * Persists one SLO snapshot row per uptime target. Best-effort by design:
 * observability reads must never fail because the write path is unavailable,
 * so configuration and database errors are returned rather than thrown.
 */
export async function persistSloSnapshots(
  input: PersistSloSnapshotsInput
): Promise<PersistSloSnapshotsResult> {
  if (input.summaries.length === 0) {
    return { attempted: 0, inserted: 0 };
  }

  const measuredAtMs = input.measuredAtMs ?? Date.now();
  const rows = input.summaries.map((summary) => buildSloRow(summary, measuredAtMs));

  try {
    const recentlyMeasured = await findRecentlyMeasuredSloNames(
      rows.map((row) => row.slo_name),
      measuredAtMs
    );
    const pendingRows = rows.filter((row) => !recentlyMeasured.has(row.slo_name));
    if (pendingRows.length === 0) {
      return { attempted: rows.length, inserted: 0 };
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('slo_metrics').insert(pendingRows);
    if (error) {
      return { attempted: rows.length, inserted: 0, error: error.message };
    }
    return { attempted: rows.length, inserted: pendingRows.length };
  } catch (err) {
    return {
      attempted: rows.length,
      inserted: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
