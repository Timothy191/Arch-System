import {
  whatsappDispatchResponseSchema,
  whatsappMusterAlertSchema,
  whatsappShiftDispatchSchema,
} from './whatsapp.schema';

describe('whatsappShiftDispatchSchema', () => {
  it('validates a complete, valid shift dispatch payload', () => {
    const validPayload = {
      department: 'drilling',
      shiftType: 'day',
      shiftDate: '2026-11-02',
      supervisorName: 'J. Smith',
      safetyStatus: 'all_clear',
      targetMetersOrTons: 450,
      achievedMetersOrTons: 472.5,
      activeFleetCount: 6,
      operationalNotes: 'Completed bench 4 blast hole drilling ahead of schedule.',
      recipientGroupOrPhone: '+27821234567',
    };

    const parsed = whatsappShiftDispatchSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid shift type or department', () => {
    const invalidPayload = {
      department: 'marketing',
      shiftType: 'morning',
      shiftDate: '2026-11-02',
      supervisorName: 'J. Smith',
      safetyStatus: 'all_clear',
      operationalNotes: 'Notes',
      recipientGroupOrPhone: '+27821234567',
    };

    const parsed = whatsappShiftDispatchSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid date format', () => {
    const invalidPayload = {
      department: 'production',
      shiftType: 'night',
      shiftDate: '02-11-2026',
      supervisorName: 'A. Ndlovu',
      safetyStatus: 'all_clear',
      operationalNotes: 'Standard night cycle.',
      recipientGroupOrPhone: 'Production-Lead-Group',
    };

    const parsed = whatsappShiftDispatchSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});

describe('whatsappMusterAlertSchema', () => {
  it('validates an urgent muster alert broadcast', () => {
    const alert = {
      alertId: '123e4567-e89b-12d3-a456-426614174000',
      incidentType: 'pit_wall_instability',
      evacuationZone: 'Sector 4 North Wall',
      musterPoint: 'Muster Station Bravo',
      severity: 'critical',
      broadcastMessage:
        'All personnel evacuate Sector 4 North Wall immediately and report to Muster Station Bravo.',
      initiatedBy: 'Control Room Dispatch',
      recipientGroup: 'Mine-Wide-Emergency',
    };

    const parsed = whatsappMusterAlertSchema.safeParse(alert);
    expect(parsed.success).toBe(true);
  });

  it('rejects a broadcast message shorter than 10 characters', () => {
    const alert = {
      incidentType: 'fire',
      evacuationZone: 'Plant A',
      musterPoint: 'Muster Station Alpha',
      severity: 'high',
      broadcastMessage: 'Evacuate',
      initiatedBy: 'Operator',
      recipientGroup: 'Emergency',
    };

    const parsed = whatsappMusterAlertSchema.safeParse(alert);
    expect(parsed.success).toBe(false);
  });
});

describe('whatsappDispatchResponseSchema', () => {
  it('validates a successful dispatch response', () => {
    const response = {
      success: true,
      dispatchId: 'disp_991823',
      timestamp: '2026-11-02T13:20:00.000Z',
      deliveredCount: 42,
    };

    const parsed = whatsappDispatchResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });
});
