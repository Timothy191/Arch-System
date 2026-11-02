import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

export const domainEventTypeSchema = z.enum([
  'shift.started',
  'shift.signed',
  'breakdown.reported',
  'breakdown.resolved',
  'muster.initiated',
  'muster.cleared',
  'telemetry.alert',
]);
export type DomainEventType = z.infer<typeof domainEventTypeSchema>;

export const shiftStartedEventPayloadSchema = z.object({
  shiftId: z.string().min(1),
  shiftType: z.enum(['day', 'night', 'swing']),
  supervisorId: z.string().min(1),
  activeRigs: z.array(z.string()),
  targetTonsOrMeters: z.number().nonnegative(),
});
export type ShiftStartedEventPayload = z.infer<typeof shiftStartedEventPayloadSchema>;

export const breakdownReportedEventPayloadSchema = z.object({
  breakdownId: uuidSchema,
  assetId: z.string().min(1),
  assetCategory: z.enum(['excavator', 'haul_truck', 'drill_rig', 'conveyor', 'dozer']),
  severity: z.enum(['critical', 'high', 'moderate', 'low']),
  description: z.string().min(5).max(1000),
  reportedBy: z.string().min(1),
  estimatedDowntimeMinutes: z.number().int().nonnegative().optional(),
});
export type BreakdownReportedEventPayload = z.infer<typeof breakdownReportedEventPayloadSchema>;

export const musterInitiatedEventPayloadSchema = z.object({
  musterAlertId: uuidSchema,
  zone: z.string().min(1),
  musterPoint: z.string().min(1),
  reason: z.string().min(5).max(500),
  evacuationDeadline: z.string().datetime(),
});
export type MusterInitiatedEventPayload = z.infer<typeof musterInitiatedEventPayloadSchema>;

export const shiftSignedEventPayloadSchema = z.object({
  shiftId: z.string().min(1),
  signedBy: z.string().min(1),
  approverRole: z.string().min(1),
  tamperEvidentHash: z.string().length(64),
  previousShiftHash: z.string().length(64).optional(),
});
export type ShiftSignedEventPayload = z.infer<typeof shiftSignedEventPayloadSchema>;

/**
 * Standard Domain Event Envelope following Hexagonal & Domain-Driven Design standards.
 */
export const domainEventEnvelopeSchema = z.object({
  eventId: uuidSchema,
  eventType: domainEventTypeSchema,
  occurredAt: z.string().datetime(),
  producer: nonEmptyString.max(120),
  correlationId: uuidSchema.optional(),
  departmentId: nonEmptyString.max(64),
  payload: z.record(z.string(), z.unknown()),
});
export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;
