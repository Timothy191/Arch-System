import { z } from 'zod';

export const OPERATIONAL_ALERT_EVENT_TYPES = [
  'contractor.expiry.threshold',
  'gate.heartbeat.fault',
  'visitor.auto_exit.completed',
  'equipment.breakdown.reported',
  'equipment.breakdown.escalated',
  'observability.slo.breached',
  'scada.telemetry.anomaly',
] as const;

export const OPERATIONAL_ALERT_SEVERITIES = ['info', 'warning', 'high', 'critical'] as const;

export const OPERATIONAL_ALERT_SOURCES = [
  'cron.contractor-expiry',
  'api.access-control.gates.heartbeat',
  'cron.visitor-auto-exit',
  'api.engineering.breakdown-alert',
  'workflow.equipment-maintenance',
  'cron.observability-slo',
  'scada.telemetry-monitor',
] as const;

export const OPERATIONAL_ALERT_WORKFLOW_IDS = [
  'contractor-expiry-alert',
  'access-control-gate-fault',
  'visitor-auto-exit-alert',
  'equipment-breakdown-alert',
  'equipment-breakdown-escalation',
  'observability-slo-breach',
  'scada-telemetry-anomaly',
] as const;

export const operationalAlertEventTypeSchema = z.enum(OPERATIONAL_ALERT_EVENT_TYPES);
export const operationalAlertSeveritySchema = z.enum(OPERATIONAL_ALERT_SEVERITIES);
export const operationalAlertSourceSchema = z.enum(OPERATIONAL_ALERT_SOURCES);
export const operationalAlertWorkflowIdSchema = z.enum(OPERATIONAL_ALERT_WORKFLOW_IDS);

export const contractorExpiryThresholdEventSchema = z.object({
  eventType: z.literal('contractor.expiry.threshold'),
  source: z.literal('cron.contractor-expiry').default('cron.contractor-expiry'),
  expiringCount: z.number().int().min(0),
  thresholdCount: z.number().int().min(1).default(1),
  cutoffIso: z.string().min(1),
  runTimestamp: z.string().min(1),
  jobId: z.string().min(1).optional(),
  subscriberId: z.string().min(1).optional(),
});

export const gateHeartbeatFaultEventSchema = z.object({
  eventType: z.literal('gate.heartbeat.fault'),
  source: z
    .literal('api.access-control.gates.heartbeat')
    .default('api.access-control.gates.heartbeat'),
  gateId: z.string().min(1),
  gateName: z.string().min(1),
  gateLocation: z.string().min(1),
  faultMessage: z.string(),
  isMaintenance: z.boolean().default(false),
  interlockActive: z.boolean().default(false),
  firmwareVersion: z.string().nullable().default(null),
  timestamp: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const visitorAutoExitCompletedEventSchema = z.object({
  eventType: z.literal('visitor.auto_exit.completed'),
  source: z.literal('cron.visitor-auto-exit').default('cron.visitor-auto-exit'),
  autoExitedCount: z.number().int().min(0),
  visitorIds: z.array(z.string().min(1)).default([]),
  departmentId: z.string().min(1),
  timestamp: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const equipmentBreakdownReportedEventSchema = z.object({
  eventType: z.literal('equipment.breakdown.reported'),
  source: z
    .enum(['api.engineering.breakdown-alert', 'workflow.equipment-maintenance'])
    .default('workflow.equipment-maintenance'),
  equipmentId: z.string().min(1),
  description: z.string().min(1),
  reportedAt: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const equipmentBreakdownEscalatedEventSchema = z.object({
  eventType: z.literal('equipment.breakdown.escalated'),
  source: z.literal('workflow.equipment-maintenance').default('workflow.equipment-maintenance'),
  equipmentId: z.string().min(1),
  status: z.string().min(1),
  downtimeHours: z.number().min(0).default(24),
  escalationThresholdHours: z.number().min(1).default(24),
  escalatedAt: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const observabilitySloBreachedEventSchema = z.object({
  eventType: z.literal('observability.slo.breached'),
  source: z.literal('cron.observability-slo').default('cron.observability-slo'),
  targetId: z.enum(['supabase', 'redis', 'fuxa_scada', 'portal_runtime']),
  label: z.string().min(1),
  currentStatus: z.enum(['UP', 'DEGRADED', 'DOWN']),
  sloBudgetState: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']),
  sla24hPct: z.number().min(0).max(100),
  p95LatencyMs: z.number().min(0),
  checkedAt: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const scadaTelemetryAnomalyEventSchema = z.object({
  eventType: z.literal('scada.telemetry.anomaly'),
  source: z.literal('scada.telemetry-monitor').default('scada.telemetry-monitor'),
  tagId: z.string().min(1),
  tagName: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  value: z.number(),
  quality: z.string().min(1),
  deviationSigma: z.number().min(0).default(0),
  severityThresholdSigma: z.number().positive().default(3),
  recordedAt: z.string().min(1),
  subscriberId: z.string().min(1).optional(),
});

export const operationalAlertEventSchema = z.discriminatedUnion('eventType', [
  contractorExpiryThresholdEventSchema,
  gateHeartbeatFaultEventSchema,
  visitorAutoExitCompletedEventSchema,
  equipmentBreakdownReportedEventSchema,
  equipmentBreakdownEscalatedEventSchema,
  observabilitySloBreachedEventSchema,
  scadaTelemetryAnomalyEventSchema,
]);

export const operationalAlertDispatchStatusSchema = z.enum([
  'triggered',
  'suppressed',
  'skipped_unconfigured',
  'validation_error',
  'delivery_error',
]);

export type OperationalAlertEventType = (typeof OPERATIONAL_ALERT_EVENT_TYPES)[number];
export type OperationalAlertSeverity = (typeof OPERATIONAL_ALERT_SEVERITIES)[number];
export type OperationalAlertSource = (typeof OPERATIONAL_ALERT_SOURCES)[number];
export type OperationalAlertWorkflowId = (typeof OPERATIONAL_ALERT_WORKFLOW_IDS)[number];
export type OperationalAlertDispatchStatus = z.infer<typeof operationalAlertDispatchStatusSchema>;

export type ContractorExpiryThresholdEvent = z.infer<typeof contractorExpiryThresholdEventSchema>;
export type GateHeartbeatFaultEvent = z.infer<typeof gateHeartbeatFaultEventSchema>;
export type VisitorAutoExitCompletedEvent = z.infer<typeof visitorAutoExitCompletedEventSchema>;
export type EquipmentBreakdownReportedEvent = z.infer<typeof equipmentBreakdownReportedEventSchema>;
export type EquipmentBreakdownEscalatedEvent = z.infer<
  typeof equipmentBreakdownEscalatedEventSchema
>;
export type ObservabilitySloBreachedEvent = z.infer<typeof observabilitySloBreachedEventSchema>;
export type ScadaTelemetryAnomalyEvent = z.infer<typeof scadaTelemetryAnomalyEventSchema>;
export type OperationalAlertEvent = z.infer<typeof operationalAlertEventSchema>;

export type OperationalAlertDispatchResult =
  | {
      readonly status: 'triggered';
      readonly eventType: OperationalAlertEventType;
      readonly workflowId: OperationalAlertWorkflowId;
      readonly subscriberId: string;
      readonly dedupeKey: string;
      readonly transactionId?: string;
    }
  | {
      readonly status: 'suppressed';
      readonly eventType: OperationalAlertEventType;
      readonly reason: 'condition_not_met' | 'cooldown_active';
      readonly dedupeKey: string;
    }
  | {
      readonly status: 'skipped_unconfigured';
      readonly eventType: OperationalAlertEventType;
      readonly workflowId: OperationalAlertWorkflowId;
      readonly subscriberId: string;
      readonly dedupeKey: string;
    }
  | {
      readonly status: 'validation_error';
      readonly eventType?: string;
      readonly errorMessage: string;
    }
  | {
      readonly status: 'delivery_error';
      readonly eventType: OperationalAlertEventType;
      readonly workflowId: OperationalAlertWorkflowId;
      readonly subscriberId: string;
      readonly dedupeKey: string;
      readonly errorMessage: string;
    };
