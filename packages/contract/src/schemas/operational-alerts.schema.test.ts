import {
  OPERATIONAL_ALERT_EVENT_TYPES,
  OPERATIONAL_ALERT_WORKFLOW_IDS,
  operationalAlertDispatchStatusSchema,
  operationalAlertEventSchema,
} from './operational-alerts.schema';

describe('operational-alerts.schema', () => {
  it('validates all 7 operational alert event variants and applies defaults', () => {
    const validEvents = [
      {
        eventType: 'contractor.expiry.threshold' as const,
        expiringCount: 3,
        cutoffIso: '2026-11-28T00:00:00.000Z',
        runTimestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'gate.heartbeat.fault' as const,
        gateId: 'GATE-01',
        gateName: 'North Gate',
        gateLocation: 'North Turnstile',
        faultMessage: 'Sensor obstructed',
        timestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'visitor.auto_exit.completed' as const,
        autoExitedCount: 2,
        visitorIds: ['vis-1', 'vis-2'],
        departmentId: 'dept-ac',
        timestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'equipment.breakdown.reported' as const,
        equipmentId: 'EXC-09',
        description: 'Hydraulic pressure loss',
        reportedAt: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'equipment.breakdown.escalated' as const,
        equipmentId: 'EXC-09',
        status: 'breakdown',
        escalatedAt: '2026-11-27T12:00:00.000Z',
      },
      {
        eventType: 'observability.slo.breached' as const,
        targetId: 'supabase' as const,
        label: 'Supabase Cloud',
        currentStatus: 'DOWN' as const,
        sloBudgetState: 'CRITICAL' as const,
        sla24hPct: 94.5,
        p95LatencyMs: 1850,
        checkedAt: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'scada.telemetry.anomaly' as const,
        tagId: 'TAG-CRUSHER-TEMP',
        tagName: 'Primary Crusher Bearing Temp',
        value: 112.4,
        quality: 'BAD (0x04)',
        recordedAt: '2026-11-26T12:00:00.000Z',
      },
    ];

    expect(validEvents).toHaveLength(OPERATIONAL_ALERT_EVENT_TYPES.length);
    expect(OPERATIONAL_ALERT_WORKFLOW_IDS).toHaveLength(7);

    for (const candidate of validEvents) {
      const parsed = operationalAlertEventSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects unknown event types and invalid negative counts', () => {
    const unknownEvent = operationalAlertEventSchema.safeParse({
      eventType: 'unknown.event',
    });
    expect(unknownEvent.success).toBe(false);

    const negativeExpiry = operationalAlertEventSchema.safeParse({
      eventType: 'contractor.expiry.threshold',
      expiringCount: -1,
      cutoffIso: '2026-11-28T00:00:00.000Z',
      runTimestamp: '2026-11-26T12:00:00.000Z',
    });
    expect(negativeExpiry.success).toBe(false);
  });

  it('validates dispatch status enum values', () => {
    expect(operationalAlertDispatchStatusSchema.safeParse('triggered').success).toBe(true);
    expect(operationalAlertDispatchStatusSchema.safeParse('suppressed').success).toBe(true);
    expect(operationalAlertDispatchStatusSchema.safeParse('invalid_status').success).toBe(false);
  });
});
