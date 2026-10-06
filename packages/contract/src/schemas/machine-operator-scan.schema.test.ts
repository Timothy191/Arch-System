import {
  machineOperatorScanRequestSchema,
  machineOperatorScanResponseSchema,
} from './machine-operator-scan.schema';

describe('machineOperatorScanRequestSchema', () => {
  const departmentId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  it('accepts a machine-only preview scan and trims scanner whitespace', () => {
    expect(
      machineOperatorScanRequestSchema.parse({
        departmentId,
        machineCode: '  TRK-101\r\n',
      })
    ).toEqual({ departmentId, machineCode: 'TRK-101' });
  });

  it('accepts the second scan and optional site selection', () => {
    expect(
      machineOperatorScanRequestSchema.safeParse({
        departmentId,
        machineCode: 'TRK-101',
        operatorCode: 'EMP-204',
        siteId: departmentId,
      }).success
    ).toBe(true);
  });

  it('accepts dropdown machine and operator selections', () => {
    expect(
      machineOperatorScanRequestSchema.safeParse({
        departmentId,
        machineId: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
        operatorId: 'd290f1ee-6c54-4b01-90e6-d701748f0853',
      }).success
    ).toBe(true);
  });

  it('rejects conflicting scan and dropdown values for the same entity', () => {
    expect(
      machineOperatorScanRequestSchema.safeParse({
        departmentId,
        machineId: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
        machineCode: 'TRK-101',
      }).success
    ).toBe(false);
    expect(
      machineOperatorScanRequestSchema.safeParse({
        departmentId,
        machineCode: 'TRK-101',
        operatorId: 'd290f1ee-6c54-4b01-90e6-d701748f0853',
        operatorCode: 'EMP-204',
      }).success
    ).toBe(false);
  });

  it.each(['', 'machine,or(id.eq.anything)', '<script>', 'x'.repeat(129)])(
    'rejects unsafe or unsupported scan payloads (%s)',
    (machineCode) => {
      expect(
        machineOperatorScanRequestSchema.safeParse({ departmentId, machineCode }).success
      ).toBe(false);
    }
  );
});

describe('machineOperatorScanResponseSchema', () => {
  const machine = {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0852',
    name: 'Truck 101',
    machineType: 'Dump Truck',
    siteId: null,
    requiresHourlyLoads: true,
  };

  it('distinguishes machine preview from a persisted assignment', () => {
    expect(machineOperatorScanResponseSchema.parse({ stage: 'machine', machine }).stage).toBe(
      'machine'
    );
    expect(
      machineOperatorScanResponseSchema.safeParse({
        stage: 'assignment',
        machine,
        operator: {
          id: 'd290f1ee-6c54-4b01-90e6-d701748f0853',
          name: 'Operator One',
        },
        operationId: 'd290f1ee-6c54-4b01-90e6-d701748f0854',
        assignedAt: '2026-10-06T04:00:00.000Z',
        alreadyAssigned: false,
        checks: {
          machineActive: true,
          badgeValid: true,
          badgeScanned: true,
          operatorActive: true,
          medicalValid: true,
          inductionValid: true,
          machineQualification: 'not_configured',
        },
      }).success
    ).toBe(true);
  });
});
