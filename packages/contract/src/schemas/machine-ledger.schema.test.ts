import { machineLedgerCloseoutSchema, machineTimeAllocationSchema } from './machine-ledger.schema';

describe('machineTimeAllocationSchema', () => {
  const baseAllocation = {
    machine_id: '123e4567-e89b-12d3-a456-426614174000',
    machine_name: 'CAT 777D (DT01)',
    opening_smr: 1000.0,
    closing_smr: 1010.0, // 10.0 operating hours
    breakdown_hours: 1.0,
    delay_hours: 1.0, // Total = 12.0 hours
  };

  it('validates standard 12.0 hour allocation without overrun_reason', () => {
    const result = machineTimeAllocationSchema.safeParse(baseAllocation);
    expect(result.success).toBe(true);
  });

  it('validates allocation up to 12.5h when overrun_reason is provided', () => {
    const allocationWithOverrun = {
      ...baseAllocation,
      closing_smr: 1010.5, // 10.5 operating + 1 breakdown + 1 delay = 12.5 hours
      overrun_reason: 'Shift handover delayed due to blast clearing',
    };
    const result = machineTimeAllocationSchema.safeParse(allocationWithOverrun);
    expect(result.success).toBe(true);
  });

  it('fails when allocation exceeds 12.0h without overrun_reason', () => {
    const allocationMissingReason = {
      ...baseAllocation,
      closing_smr: 1010.2, // 12.2 hours
    };
    const result = machineTimeAllocationSchema.safeParse(allocationMissingReason);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('overrun_reason');
      expect(result.error.issues[0]?.message).toMatch(/Overrun reason is required/);
    }
  });

  it('fails when allocation exceeds 12.5h even with overrun_reason', () => {
    const allocationExceedingMax = {
      ...baseAllocation,
      closing_smr: 1010.6, // 10.6 + 1 + 1 = 12.6 hours (> 12.5h)
      overrun_reason: 'Major blast cleanup',
    };
    const result = machineTimeAllocationSchema.safeParse(allocationExceedingMax);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('closing_smr');
      expect(result.error.issues[0]?.message).toMatch(/exceeds the maximum 12.5-hour shift window/);
    }
  });

  it('fails when closing_smr is less than opening_smr', () => {
    const invalidSmr = {
      ...baseAllocation,
      closing_smr: 999.0,
    };
    const result = machineTimeAllocationSchema.safeParse(invalidSmr);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('closing_smr');
      expect(result.error.issues[0]?.message).toBe('Closing SMR cannot be less than Opening SMR');
    }
  });

  it('validates machineLedgerCloseoutSchema containing valid allocations', () => {
    const closeout = {
      shift_date: '2026-10-07',
      shift_type: 'day' as const,
      allocations: [baseAllocation],
    };
    const result = machineLedgerCloseoutSchema.safeParse(closeout);
    expect(result.success).toBe(true);
  });
});
