/** @jest-environment node */

const mockSendOperationalAlert = jest.fn();
jest.mock('@repo/utils/novu', () => ({
  sendOperationalAlert: (...args: unknown[]) => mockSendOperationalAlert(...args),
}));

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@repo/logger/server', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

import {
  resetAlertTriggerCooldowns,
  triggerOperationalAlertWorkflow,
} from './operational-alert-triggers';

describe('operational-alert-triggers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAlertTriggerCooldowns();
    mockSendOperationalAlert.mockResolvedValue({
      acknowledged: true,
      transactionId: 'tx-mock-1',
    });
    process.env = {
      ...originalEnv,
      NOVU_API_KEY: 'test-novu-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('triggers all 7 operational alert workflows with expected subscriber, workflowId, and context payload', async () => {
    const cases = [
      {
        event: {
          eventType: 'contractor.expiry.threshold' as const,
          source: 'cron.contractor-expiry' as const,
          expiringCount: 4,
          thresholdCount: 1,
          cutoffIso: '2026-11-28T00:00:00.000Z',
          runTimestamp: '2026-11-26T12:00:00.000Z',
          jobId: 'job-1',
        },
        subscriberId: 'access-control-ops',
        workflowId: 'contractor-expiry-alert',
      },
      {
        event: {
          eventType: 'gate.heartbeat.fault' as const,
          source: 'api.access-control.gates.heartbeat' as const,
          gateId: 'GATE-01-NORTH',
          gateName: 'North Gate',
          gateLocation: 'North Perimeter',
          faultMessage: 'Optical barrier obstructed',
          isMaintenance: false,
          interlockActive: true,
          firmwareVersion: 'v2.4.1',
          timestamp: '2026-11-26T12:00:00.000Z',
        },
        subscriberId: 'access-control-ops',
        workflowId: 'access-control-gate-fault',
      },
      {
        event: {
          eventType: 'visitor.auto_exit.completed' as const,
          source: 'cron.visitor-auto-exit' as const,
          autoExitedCount: 2,
          visitorIds: ['vis-1', 'vis-2'],
          departmentId: 'dept-ac',
          timestamp: '2026-11-26T12:00:00.000Z',
        },
        subscriberId: 'access-control-ops',
        workflowId: 'visitor-auto-exit-alert',
      },
      {
        event: {
          eventType: 'equipment.breakdown.reported' as const,
          source: 'workflow.equipment-maintenance' as const,
          equipmentId: 'EXC-09',
          description: 'Hydraulic hose rupture',
          reportedAt: '2026-11-26T12:00:00.000Z',
        },
        subscriberId: 'engineering-ops',
        workflowId: 'equipment-breakdown-alert',
      },
      {
        event: {
          eventType: 'equipment.breakdown.escalated' as const,
          source: 'workflow.equipment-maintenance' as const,
          equipmentId: 'EXC-09',
          status: 'breakdown',
          downtimeHours: 24,
          escalationThresholdHours: 24,
          escalatedAt: '2026-11-27T12:00:00.000Z',
        },
        subscriberId: 'management-ops',
        workflowId: 'equipment-breakdown-escalation',
      },
      {
        event: {
          eventType: 'observability.slo.breached' as const,
          source: 'cron.observability-slo' as const,
          targetId: 'supabase' as const,
          label: 'Supabase Cloud',
          currentStatus: 'DOWN' as const,
          sloBudgetState: 'CRITICAL' as const,
          sla24hPct: 92.1,
          p95LatencyMs: 2100,
          checkedAt: '2026-11-26T12:00:00.000Z',
        },
        subscriberId: 'platform-ops',
        workflowId: 'observability-slo-breach',
      },
      {
        event: {
          eventType: 'scada.telemetry.anomaly' as const,
          source: 'scada.telemetry-monitor' as const,
          tagId: 'CRUSHER-01-TEMP',
          tagName: 'Primary Crusher Bearing Temp',
          value: 118.2,
          quality: 'BAD (0x04)',
          deviationSigma: 4.1,
          severityThresholdSigma: 3,
          recordedAt: '2026-11-26T12:00:00.000Z',
        },
        subscriberId: 'control-room-ops',
        workflowId: 'scada-telemetry-anomaly',
      },
    ];

    for (const testCase of cases) {
      const result = await triggerOperationalAlertWorkflow({ event: testCase.event });
      expect(result.status).toBe('triggered');
      if (result.status === 'triggered') {
        expect(result.workflowId).toBe(testCase.workflowId);
        expect(result.subscriberId).toBe(testCase.subscriberId);
        expect(result.transactionId).toBe('tx-mock-1');
      }
      expect(mockSendOperationalAlert).toHaveBeenCalledWith(
        testCase.subscriberId,
        testCase.workflowId,
        expect.objectContaining({
          eventType: testCase.event.eventType,
          source: testCase.event.source,
        })
      );
    }

    expect(mockSendOperationalAlert).toHaveBeenCalledTimes(7);
  });

  it('suppresses all normal operating condition events without calling sendOperationalAlert', async () => {
    const normalEvents = [
      {
        eventType: 'contractor.expiry.threshold' as const,
        source: 'cron.contractor-expiry' as const,
        expiringCount: 0,
        thresholdCount: 1,
        cutoffIso: '2026-11-28T00:00:00.000Z',
        runTimestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'gate.heartbeat.fault' as const,
        source: 'api.access-control.gates.heartbeat' as const,
        gateId: 'GATE-01',
        gateName: 'North Gate',
        gateLocation: 'North Perimeter',
        faultMessage: '',
        isMaintenance: false,
        interlockActive: true,
        firmwareVersion: null,
        timestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'gate.heartbeat.fault' as const,
        source: 'api.access-control.gates.heartbeat' as const,
        gateId: 'GATE-02',
        gateName: 'South Gate',
        gateLocation: 'South Perimeter',
        faultMessage: 'Scheduled sensor swap',
        isMaintenance: true,
        interlockActive: false,
        firmwareVersion: null,
        timestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'visitor.auto_exit.completed' as const,
        source: 'cron.visitor-auto-exit' as const,
        autoExitedCount: 0,
        visitorIds: [],
        departmentId: 'dept-ac',
        timestamp: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'equipment.breakdown.escalated' as const,
        source: 'workflow.equipment-maintenance' as const,
        equipmentId: 'EXC-09',
        status: 'operational',
        downtimeHours: 24,
        escalationThresholdHours: 24,
        escalatedAt: '2026-11-27T12:00:00.000Z',
      },
      {
        eventType: 'observability.slo.breached' as const,
        source: 'cron.observability-slo' as const,
        targetId: 'redis' as const,
        label: 'Redis Cache',
        currentStatus: 'UP' as const,
        sloBudgetState: 'HEALTHY' as const,
        sla24hPct: 100,
        p95LatencyMs: 32,
        checkedAt: '2026-11-26T12:00:00.000Z',
      },
      {
        eventType: 'scada.telemetry.anomaly' as const,
        source: 'scada.telemetry-monitor' as const,
        tagId: 'CRUSHER-01-TEMP',
        tagName: 'Primary Crusher Bearing Temp',
        value: 62.5,
        quality: 'GOOD (0x00)',
        deviationSigma: 0.4,
        severityThresholdSigma: 3,
        recordedAt: '2026-11-26T12:00:00.000Z',
      },
    ];

    for (const event of normalEvents) {
      const result = await triggerOperationalAlertWorkflow({ event });
      expect(result).toEqual(
        expect.objectContaining({
          status: 'suppressed',
          reason: 'condition_not_met',
        })
      );
    }

    expect(mockSendOperationalAlert).not.toHaveBeenCalled();
  });

  it('returns validation_error for malformed payloads without calling sendOperationalAlert', async () => {
    const result = await triggerOperationalAlertWorkflow({
      event: {
        eventType: 'contractor.expiry.threshold',
        expiringCount: -5,
      } as never,
    });

    expect(result.status).toBe('validation_error');
    expect(mockSendOperationalAlert).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('enforces cooldown deduplication, expires after cooldown window, and supports bypassCooldown', async () => {
    const event = {
      eventType: 'gate.heartbeat.fault' as const,
      source: 'api.access-control.gates.heartbeat' as const,
      gateId: 'GATE-COOLDOWN',
      gateName: 'West Gate',
      gateLocation: 'West Perimeter',
      faultMessage: 'Controller offline',
      isMaintenance: false,
      interlockActive: false,
      firmwareVersion: null,
      timestamp: '2026-11-26T12:00:00.000Z',
    };

    const first = await triggerOperationalAlertWorkflow({ event, nowMs: 1_000_000 });
    expect(first.status).toBe('triggered');

    const second = await triggerOperationalAlertWorkflow({ event, nowMs: 1_050_000 });
    expect(second).toEqual(
      expect.objectContaining({
        status: 'suppressed',
        reason: 'cooldown_active',
      })
    );

    const bypassed = await triggerOperationalAlertWorkflow({
      event,
      nowMs: 1_050_000,
      bypassCooldown: true,
    });
    expect(bypassed.status).toBe('triggered');

    const afterCooldown = await triggerOperationalAlertWorkflow({
      event,
      nowMs: 1_050_000 + 301_000,
    });
    expect(afterCooldown.status).toBe('triggered');
    expect(mockSendOperationalAlert).toHaveBeenCalledTimes(3);
  });

  it('returns skipped_unconfigured when NOVU_API_KEY is absent', async () => {
    delete process.env.NOVU_API_KEY;

    const result = await triggerOperationalAlertWorkflow({
      event: {
        eventType: 'contractor.expiry.threshold',
        source: 'cron.contractor-expiry',
        expiringCount: 2,
        thresholdCount: 1,
        cutoffIso: '2026-11-28T00:00:00.000Z',
        runTimestamp: '2026-11-26T12:00:00.000Z',
      },
    });

    expect(result.status).toBe('skipped_unconfigured');
    expect(mockSendOperationalAlert).not.toHaveBeenCalled();
  });

  it('returns delivery_error and logs warning without throwing when Novu delivery fails', async () => {
    mockSendOperationalAlert.mockRejectedValueOnce(new Error('Novu 422 workflow_not_found'));

    const result = await triggerOperationalAlertWorkflow({
      event: {
        eventType: 'contractor.expiry.threshold',
        source: 'cron.contractor-expiry',
        expiringCount: 2,
        thresholdCount: 1,
        cutoffIso: '2026-11-28T00:00:00.000Z',
        runTimestamp: '2026-11-26T12:00:00.000Z',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'delivery_error',
        workflowId: 'contractor-expiry-alert',
        errorMessage: 'Novu 422 workflow_not_found',
      })
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'operational_alert_delivery_failed',
      })
    );
  });
});
