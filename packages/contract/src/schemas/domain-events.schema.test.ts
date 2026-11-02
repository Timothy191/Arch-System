import {
  breakdownReportedEventPayloadSchema,
  domainEventEnvelopeSchema,
  musterInitiatedEventPayloadSchema,
  shiftSignedEventPayloadSchema,
  shiftStartedEventPayloadSchema,
} from './domain-events.schema';

describe('domainEventEnvelopeSchema', () => {
  it('validates a complete domain event envelope', () => {
    const envelope = {
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      eventType: 'breakdown.reported',
      occurredAt: '2026-11-02T14:10:00.000Z',
      producer: 'engineering.dispatcher',
      correlationId: '223e4567-e89b-12d3-a456-426614174000',
      departmentId: 'engineering',
      payload: {
        assetId: 'CAT-777-01',
        severity: 'high',
      },
    };

    const parsed = domainEventEnvelopeSchema.safeParse(envelope);
    expect(parsed.success).toBe(true);
  });

  it('rejects an unlisted event type', () => {
    const envelope = {
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      eventType: 'unknown.event',
      occurredAt: '2026-11-02T14:10:00.000Z',
      producer: 'system',
      departmentId: 'engineering',
      payload: {},
    };

    const parsed = domainEventEnvelopeSchema.safeParse(envelope);
    expect(parsed.success).toBe(false);
  });
});

describe('shiftStartedEventPayloadSchema', () => {
  it('validates a shift started payload', () => {
    const payload = {
      shiftId: 'shift_20261102_02',
      shiftType: 'day',
      supervisorId: 'emp_042',
      activeRigs: ['DR-01', 'DR-02'],
      targetTonsOrMeters: 550,
    };

    const parsed = shiftStartedEventPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});

describe('breakdownReportedEventPayloadSchema', () => {
  it('validates a breakdown report payload', () => {
    const payload = {
      breakdownId: '123e4567-e89b-12d3-a456-426614174000',
      assetId: 'EX-01',
      assetCategory: 'excavator',
      severity: 'critical',
      description: 'Main boom cylinder oil leak',
      reportedBy: 'operator_12',
      estimatedDowntimeMinutes: 90,
    };

    const parsed = breakdownReportedEventPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});

describe('musterInitiatedEventPayloadSchema', () => {
  it('validates a muster initiation payload', () => {
    const payload = {
      musterAlertId: '123e4567-e89b-12d3-a456-426614174000',
      zone: 'Sector 3 Haul Ramp',
      musterPoint: 'Muster Station Alpha',
      reason: 'Unplanned blast perimeter breach',
      evacuationDeadline: '2026-11-02T14:30:00.000Z',
    };

    const parsed = musterInitiatedEventPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});

describe('shiftSignedEventPayloadSchema', () => {
  it('validates a shift sign event payload with SHA-256 tamper-evident hash', () => {
    const payload = {
      shiftId: 'shift_20261102_01',
      signedBy: 'supervisor_09',
      approverRole: 'mine_manager',
      tamperEvidentHash: 'e'.repeat(64),
      previousShiftHash: 'a'.repeat(64),
    };

    const parsed = shiftSignedEventPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
