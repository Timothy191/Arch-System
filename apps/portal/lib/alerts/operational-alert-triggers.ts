import {
  type OperationalAlertDispatchResult,
  type OperationalAlertEvent,
  type OperationalAlertEventType,
  type OperationalAlertSeverity,
  type OperationalAlertWorkflowId,
  operationalAlertEventSchema,
} from '@repo/contract';
import { logger } from '@repo/logger/server';
import { sendOperationalAlert } from '@repo/utils/novu';

const SECONDS_TO_MS = 1000;
const CONTRACTOR_COOLDOWN_MS = 3600 * SECONDS_TO_MS;
const GATE_FAULT_COOLDOWN_MS = 300 * SECONDS_TO_MS;
const VISITOR_AUTO_EXIT_COOLDOWN_MS = 1800 * SECONDS_TO_MS;
const BREAKDOWN_REPORTED_COOLDOWN_MS = 600 * SECONDS_TO_MS;
const BREAKDOWN_ESCALATION_COOLDOWN_MS = 3600 * SECONDS_TO_MS;
const SLO_BREACH_COOLDOWN_MS = 900 * SECONDS_TO_MS;
const SCADA_ANOMALY_COOLDOWN_MS = 300 * SECONDS_TO_MS;
const SLO_DEGRADED_SLA_FLOOR_PCT = 99;
const SCADA_GOOD_QUALITY = 'GOOD (0x00)';
const MAX_COOLDOWN_ENTRIES = 500;

interface OperationalAlertEvaluation {
  readonly shouldTrigger: boolean;
  readonly severity: OperationalAlertSeverity;
  readonly dedupeKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

interface OperationalAlertRouteConfig {
  readonly workflowId: OperationalAlertWorkflowId;
  readonly defaultSubscriberId: string;
  readonly department: string;
  readonly cooldownMs: number;
  readonly evaluate: (event: OperationalAlertEvent) => OperationalAlertEvaluation;
}

export interface TriggerOperationalAlertOptions {
  readonly event: OperationalAlertEvent;
  readonly bypassCooldown?: boolean;
  readonly nowMs?: number;
}

const alertCooldownStore = new Map<string, number>();

export function resetAlertTriggerCooldowns(): void {
  alertCooldownStore.clear();
}

function recordCooldownTimestamp(dedupeKey: string, nowMs: number): void {
  if (alertCooldownStore.size >= MAX_COOLDOWN_ENTRIES) {
    const oldestKey = alertCooldownStore.keys().next().value;
    if (oldestKey !== undefined) {
      alertCooldownStore.delete(oldestKey);
    }
  }
  alertCooldownStore.set(dedupeKey, nowMs);
}

function isCooldownActive(options: {
  readonly dedupeKey: string;
  readonly cooldownMs: number;
  readonly nowMs: number;
}): boolean {
  const lastTriggeredAtMs = alertCooldownStore.get(options.dedupeKey);
  if (lastTriggeredAtMs === undefined) {
    return false;
  }
  return options.nowMs - lastTriggeredAtMs < options.cooldownMs;
}

const OPERATIONAL_ALERT_ROUTES: Readonly<
  Record<OperationalAlertEventType, OperationalAlertRouteConfig>
> = {
  'contractor.expiry.threshold': {
    workflowId: 'contractor-expiry-alert',
    defaultSubscriberId: 'access-control-ops',
    department: 'access-control',
    cooldownMs: CONTRACTOR_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'contractor.expiry.threshold' }
      >;
      return {
        shouldTrigger: event.expiringCount >= event.thresholdCount,
        severity: 'warning',
        dedupeKey: `contractor-expiry:${event.cutoffIso.slice(0, 10)}`,
        payload: {
          expiringCount: event.expiringCount,
          thresholdCount: event.thresholdCount,
          cutoffIso: event.cutoffIso,
          runTimestamp: event.runTimestamp,
          ...(event.jobId ? { jobId: event.jobId } : {}),
        },
      };
    },
  },
  'gate.heartbeat.fault': {
    workflowId: 'access-control-gate-fault',
    defaultSubscriberId: 'access-control-ops',
    department: 'access-control',
    cooldownMs: GATE_FAULT_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'gate.heartbeat.fault' }
      >;
      const trimmedFault = event.faultMessage.trim();
      return {
        shouldTrigger: trimmedFault.length > 0 && !event.isMaintenance,
        severity: event.interlockActive ? 'critical' : 'high',
        dedupeKey: `gate-fault:${event.gateId}`,
        payload: {
          gateId: event.gateId,
          gateName: event.gateName,
          gateLocation: event.gateLocation,
          faultMessage: trimmedFault,
          isMaintenance: event.isMaintenance,
          interlockActive: event.interlockActive,
          firmwareVersion: event.firmwareVersion,
          timestamp: event.timestamp,
        },
      };
    },
  },
  'visitor.auto_exit.completed': {
    workflowId: 'visitor-auto-exit-alert',
    defaultSubscriberId: 'access-control-ops',
    department: 'access-control',
    cooldownMs: VISITOR_AUTO_EXIT_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'visitor.auto_exit.completed' }
      >;
      return {
        shouldTrigger: event.autoExitedCount > 0,
        severity: 'info',
        dedupeKey: `visitor-auto-exit:${event.departmentId}:${event.timestamp.slice(0, 13)}`,
        payload: {
          autoExitedCount: event.autoExitedCount,
          visitorIds: event.visitorIds,
          departmentId: event.departmentId,
          timestamp: event.timestamp,
        },
      };
    },
  },
  'equipment.breakdown.reported': {
    workflowId: 'equipment-breakdown-alert',
    defaultSubscriberId: 'engineering-ops',
    department: 'engineering',
    cooldownMs: BREAKDOWN_REPORTED_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'equipment.breakdown.reported' }
      >;
      return {
        shouldTrigger: event.equipmentId.trim().length > 0 && event.description.trim().length > 0,
        severity: 'high',
        dedupeKey: `breakdown-reported:${event.equipmentId}`,
        payload: {
          equipmentId: event.equipmentId,
          description: event.description.trim(),
          reportedAt: event.reportedAt,
        },
      };
    },
  },
  'equipment.breakdown.escalated': {
    workflowId: 'equipment-breakdown-escalation',
    defaultSubscriberId: 'management-ops',
    department: 'management',
    cooldownMs: BREAKDOWN_ESCALATION_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'equipment.breakdown.escalated' }
      >;
      const isStillDown = event.status === 'breakdown' || event.status === 'maintenance';
      return {
        shouldTrigger: isStillDown && event.downtimeHours >= event.escalationThresholdHours,
        severity: 'critical',
        dedupeKey: `breakdown-escalated:${event.equipmentId}`,
        payload: {
          equipmentId: event.equipmentId,
          status: event.status,
          downtimeHours: event.downtimeHours,
          escalationThresholdHours: event.escalationThresholdHours,
          escalatedAt: event.escalatedAt,
        },
      };
    },
  },
  'observability.slo.breached': {
    workflowId: 'observability-slo-breach',
    defaultSubscriberId: 'platform-ops',
    department: 'overview',
    cooldownMs: SLO_BREACH_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'observability.slo.breached' }
      >;
      const isBreach =
        event.sloBudgetState === 'CRITICAL' ||
        (event.sloBudgetState === 'DEGRADED' && event.sla24hPct < SLO_DEGRADED_SLA_FLOOR_PCT);
      return {
        shouldTrigger: isBreach,
        severity: event.sloBudgetState === 'CRITICAL' ? 'critical' : 'warning',
        dedupeKey: `slo-breach:${event.targetId}:${event.sloBudgetState}`,
        payload: {
          targetId: event.targetId,
          label: event.label,
          currentStatus: event.currentStatus,
          sloBudgetState: event.sloBudgetState,
          sla24hPct: event.sla24hPct,
          p95LatencyMs: event.p95LatencyMs,
          checkedAt: event.checkedAt,
        },
      };
    },
  },
  'scada.telemetry.anomaly': {
    workflowId: 'scada-telemetry-anomaly',
    defaultSubscriberId: 'control-room-ops',
    department: 'control-room',
    cooldownMs: SCADA_ANOMALY_COOLDOWN_MS,
    evaluate: (rawEvent) => {
      const event = rawEvent as Extract<
        OperationalAlertEvent,
        { eventType: 'scada.telemetry.anomaly' }
      >;
      const hasBadQuality = event.quality !== SCADA_GOOD_QUALITY;
      const exceedsSigma = event.deviationSigma >= event.severityThresholdSigma;
      return {
        shouldTrigger: hasBadQuality || exceedsSigma,
        severity: exceedsSigma ? 'critical' : 'warning',
        dedupeKey: `scada-anomaly:${event.tagId}`,
        payload: {
          tagId: event.tagId,
          tagName: event.tagName,
          departmentId: event.departmentId ?? null,
          value: event.value,
          quality: event.quality,
          deviationSigma: event.deviationSigma,
          severityThresholdSigma: event.severityThresholdSigma,
          recordedAt: event.recordedAt,
        },
      };
    },
  },
};

/**
 * Evaluates whether a validated operational alert event satisfies its trigger conditions
 * and builds the normalized routing metadata without performing network I/O.
 */
export function evaluateOperationalAlertTrigger(event: OperationalAlertEvent): {
  readonly route: OperationalAlertRouteConfig;
  readonly evaluation: OperationalAlertEvaluation;
  readonly subscriberId: string;
} {
  const route = OPERATIONAL_ALERT_ROUTES[event.eventType];
  const evaluation = route.evaluate(event);
  const subscriberId = event.subscriberId?.trim() || route.defaultSubscriberId;
  return { route, evaluation, subscriberId };
}

/**
 * Validates an operational event against `@repo/contract`, evaluates trigger conditions
 * and cooldown deduplication, and dispatches the alert through `@repo/utils/novu`.
 */
export async function triggerOperationalAlertWorkflow(
  options: TriggerOperationalAlertOptions
): Promise<OperationalAlertDispatchResult> {
  const parsed = operationalAlertEventSchema.safeParse(options.event);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues[0]?.message ?? 'Invalid operational alert event';
    logger.warn({
      event: 'operational_alert_validation_failed',
      eventType: (options.event as { eventType?: string } | undefined)?.eventType,
      error: errorMessage,
    });
    return {
      status: 'validation_error',
      eventType: (options.event as { eventType?: string } | undefined)?.eventType,
      errorMessage,
    };
  }

  const validEvent = parsed.data;
  const { route, evaluation, subscriberId } = evaluateOperationalAlertTrigger(validEvent);

  if (!evaluation.shouldTrigger) {
    return {
      status: 'suppressed',
      eventType: validEvent.eventType,
      reason: 'condition_not_met',
      dedupeKey: evaluation.dedupeKey,
    };
  }

  const nowMs = options.nowMs ?? Date.now();
  if (
    !options.bypassCooldown &&
    isCooldownActive({
      dedupeKey: evaluation.dedupeKey,
      cooldownMs: route.cooldownMs,
      nowMs,
    })
  ) {
    return {
      status: 'suppressed',
      eventType: validEvent.eventType,
      reason: 'cooldown_active',
      dedupeKey: evaluation.dedupeKey,
    };
  }

  if (!process.env.NOVU_API_KEY?.trim()) {
    return {
      status: 'skipped_unconfigured',
      eventType: validEvent.eventType,
      workflowId: route.workflowId,
      subscriberId,
      dedupeKey: evaluation.dedupeKey,
    };
  }

  const enrichedPayload: Record<string, unknown> = {
    ...evaluation.payload,
    eventType: validEvent.eventType,
    source: validEvent.source,
    department: route.department,
    severity: evaluation.severity,
    dedupeKey: evaluation.dedupeKey,
    triggeredAt: new Date(nowMs).toISOString(),
  };

  try {
    const receipt = await sendOperationalAlert(subscriberId, route.workflowId, enrichedPayload);
    recordCooldownTimestamp(evaluation.dedupeKey, nowMs);
    logger.info({
      event: 'operational_alert_triggered',
      eventType: validEvent.eventType,
      workflowId: route.workflowId,
      subscriberId,
      dedupeKey: evaluation.dedupeKey,
      severity: evaluation.severity,
      transactionId: receipt?.transactionId,
    });

    return {
      status: 'triggered',
      eventType: validEvent.eventType,
      workflowId: route.workflowId,
      subscriberId,
      dedupeKey: evaluation.dedupeKey,
      ...(receipt?.transactionId ? { transactionId: receipt.transactionId } : {}),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn({
      event: 'operational_alert_delivery_failed',
      eventType: validEvent.eventType,
      workflowId: route.workflowId,
      subscriberId,
      dedupeKey: evaluation.dedupeKey,
      error: errorMessage,
    });
    return {
      status: 'delivery_error',
      eventType: validEvent.eventType,
      workflowId: route.workflowId,
      subscriberId,
      dedupeKey: evaluation.dedupeKey,
      errorMessage,
    };
  }
}
