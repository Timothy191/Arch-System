import { auditLogEntrySchema, createAuditLogEntrySchema } from './audit-log.schema';

describe('auditLogEntrySchema', () => {
  it('validates a complete audit log entry with cryptographic hashes', () => {
    const entry = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: '2026-11-02T14:00:00.000Z',
      actorId: 'emp_001',
      actorRole: 'admin',
      departmentId: 'control_room',
      action: 'shift_sign',
      resource: 'shift_closeout',
      resourceId: 'shift_20261102_01',
      status: 'success',
      durationMs: 42,
      clientIp: '192.168.1.100',
      userAgent: 'Arch-System-Portal/1.6.2',
      recordHash: 'a'.repeat(64),
      previousHash: '0'.repeat(64),
      metadata: { targetTons: 1200, achievedTons: 1240 },
    };

    const parsed = auditLogEntrySchema.safeParse(entry);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid action type', () => {
    const invalidEntry = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: '2026-11-02T14:00:00.000Z',
      actorId: 'emp_001',
      actorRole: 'operator',
      departmentId: 'drilling',
      action: 'unauthorized_action',
      resource: 'drill_rig',
      status: 'failed',
      durationMs: 10,
    };

    const parsed = auditLogEntrySchema.safeParse(invalidEntry);
    expect(parsed.success).toBe(false);
  });
});

describe('createAuditLogEntrySchema', () => {
  it('validates creation payload without id and timestamp', () => {
    const input = {
      actorId: 'emp_002',
      actorRole: 'supervisor',
      departmentId: 'production',
      action: 'elevate_privilege',
      resource: 'gate_access',
      status: 'denied',
      durationMs: 15,
    };

    const parsed = createAuditLogEntrySchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });
});
