// AGENT-TRACE: Unit tests for shift completeness validation and operational integrity rules in control room
import {
  getShiftCompleteness,
  validateBinFactor,
  validateLoadConsistency,
  validateMachineHours,
  validateShiftDataIntegrity,
} from './shift-completeness';

// Mock withCache to prevent cross-test cache pollution
jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn().mockImplementation((fn) => fn()),
}));

describe('Shift Completeness Validation', () => {
  describe('validateMachineHours', () => {
    it('returns no errors for valid hours (<= 12)', () => {
      const errors = validateMachineHours(8, 'day');
      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('returns error for hours exceeding maximum (> 12)', () => {
      const errors = validateMachineHours(13, 'day');
      const errs = errors.filter((e) => e.severity === 'error');
      expect(errs).toHaveLength(1);
      expect(errs[0]!.field).toBe('hours_worked');
      expect(errs[0]!.message).toContain('exceeds maximum 12h');
    });

    it('returns warning for high hours (> 8)', () => {
      const errors = validateMachineHours(9, 'day');
      const warnings = errors.filter((e) => e.severity === 'warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.field).toBe('hours_worked');
      expect(warnings[0]!.message).toContain('combined day + night shifts < 16h');
    });
  });

  describe('validateBinFactor', () => {
    it('returns no errors for null/undefined bin_factor', () => {
      expect(validateBinFactor(null)).toHaveLength(0);
    });

    it('returns no errors for valid bin_factor (20-100)', () => {
      expect(validateBinFactor(40.5)).toHaveLength(0);
      expect(validateBinFactor(20)).toHaveLength(0);
      expect(validateBinFactor(100)).toHaveLength(0);
    });

    it('returns error for bin_factor outside range', () => {
      const underErrors = validateBinFactor(19);
      expect(underErrors).toHaveLength(1);
      expect(underErrors[0]!.field).toBe('bin_factor');
      expect(underErrors[0]!.message).toContain('outside reasonable range');

      const overErrors = validateBinFactor(101);
      expect(overErrors).toHaveLength(1);
      expect(overErrors[0]!.field).toBe('bin_factor');
      expect(overErrors[0]!.message).toContain('outside reasonable range');
    });
  });

  describe('validateLoadConsistency', () => {
    it('returns no errors when hoursWorked is missing or 0', () => {
      expect(validateLoadConsistency(10, null)).toHaveLength(0);
      expect(validateLoadConsistency(10, 0)).toHaveLength(0);
    });

    it('returns no errors for reasonable loads per hour (5-50)', () => {
      // 160 loads / 8 hours = 20 loads/hour
      expect(validateLoadConsistency(160, 8)).toHaveLength(0);
    });

    it('returns warning for unusually low loads per hour (< 5)', () => {
      // 24 loads / 8 hours = 3 loads/hour
      const errors = validateLoadConsistency(24, 8);
      const warnings = errors.filter((e) => e.severity === 'warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.field).toBe('total_loads');
      expect(warnings[0]!.message).toContain('unusually low');
    });

    it('returns error for unusually high loads per hour (> 50)', () => {
      // 480 loads / 8 hours = 60 loads/hour
      const errors = validateLoadConsistency(480, 8);
      const errs = errors.filter((e) => e.severity === 'error');
      expect(errs).toHaveLength(1);
      expect(errs[0]!.field).toBe('total_loads');
      expect(errs[0]!.message).toContain('unusually high');
    });
  });

  describe('validateShiftDataIntegrity', () => {
    it('aggregates validations correctly', () => {
      // Valid run
      expect(validateShiftDataIntegrity('machine-1', 8, 160, 40, 'day')).toHaveLength(0);

      // Invalid run with multiple failures: hours > 12, bin_factor > 100, loads per hour too high
      const errors = validateShiftDataIntegrity('machine-1', 13, 800, 150, 'day');
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getShiftCompleteness', () => {
    const mockSupabaseBuilder = (
      data: {
        machines: any[];
        machineOps: any[];
        excavatorActs: any[];
        dozerRolls: any[];
        hourlyLoads: any[];
        breakdowns?: any[];
      },
      options: { failTable?: string } = {}
    ) => {
      return {
        from: jest.fn().mockImplementation((table: string) => {
          let responseData: any[] = [];
          if (table === 'machines') responseData = data.machines;
          else if (table === 'machine_operations') responseData = data.machineOps;
          else if (table === 'excavator_activity') responseData = data.excavatorActs;
          else if (table === 'dozer_rolls') responseData = data.dozerRolls;
          else if (table === 'hourly_loads') responseData = data.hourlyLoads;
          else if (table === 'breakdowns') responseData = data.breakdowns ?? [];

          const response =
            table === options.failTable
              ? { data: null, error: { message: `${table} unavailable` } }
              : { data: responseData, error: null };

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue(response),
            // Handle cases where .order is not called but it resolves
            then: jest.fn().mockImplementation((resolve) => resolve(response)),
          };
        }),
      } as any;
    };

    it('identifies shift as complete when all active machines have entries', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: 'm-1',
            name: 'DT-101',
            machine_type: 'dump truck',
            report_exempt: false,
          },
          {
            id: 'm-2',
            name: 'DZ-101',
            machine_type: 'dozer',
            report_exempt: false,
          },
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [{ machine_id: 'm-2', hours_operated: 8 }],
        hourlyLoads: [{ machine_id: 'm-1', total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        'dept-1',
        'control-room',
        '2026-06-15',
        'day'
      );
      expect(res.complete).toBe(true);
      expect(res.totalRequired).toBe(2);
      expect(res.totalCovered).toBe(2);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(true);
    });

    it('identifies shift as incomplete when a machine is missing an entry', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: 'm-1',
            name: 'DT-101',
            machine_type: 'dump truck',
            report_exempt: false,
          },
          {
            id: 'm-2',
            name: 'DZ-101',
            machine_type: 'dozer',
            report_exempt: false,
          },
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [], // Missing
        hourlyLoads: [{ machine_id: 'm-1', total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        'dept-1',
        'control-room',
        '2026-06-15',
        'day'
      );
      expect(res.complete).toBe(false);
      expect(res.totalRequired).toBe(2);
      expect(res.totalCovered).toBe(1);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(false);
    });

    it('ignores exempt machines in completeness calculations', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: 'm-1',
            name: 'DT-101',
            machine_type: 'dump truck',
            report_exempt: false,
          },
          {
            id: 'm-2',
            name: 'DZ-101',
            machine_type: 'dozer',
            report_exempt: true,
          }, // Exempt
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [], // Missing but exempt
        hourlyLoads: [{ machine_id: 'm-1', total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        'dept-1',
        'control-room',
        '2026-06-15',
        'day'
      );
      expect(res.complete).toBe(true);
      expect(res.totalRequired).toBe(1);
      expect(res.totalCovered).toBe(1);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(false);
      expect(res.statuses[1]!.exempt).toBe(true);
    });

    it('aggregates the shift-sheet columns per machine', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: 'm-1',
            name: 'DT-101',
            machine_type: 'dump truck',
            serial_number: 'SN-101',
            report_exempt: false,
          },
        ],
        machineOps: [
          {
            machine_id: 'm-1',
            hours_worked: 9.5,
            operator_name: null,
            start_smu: 1200,
            end_smu: 1209.5,
            operator: { full_name: 'A. Mokoena' },
            delay_entries: [
              {
                status: 'committed',
                duration_hours: 0.5,
                manual_duration_hours: null,
                is_manual_override: false,
                description: 'Bench 4 blast window',
                deleted_at: null,
                delay_category: { name: 'Blasting' },
              },
              {
                status: 'committed',
                duration_hours: 0,
                manual_duration_hours: 1.25,
                is_manual_override: true,
                description: 'Waiting for operator',
                deleted_at: null,
                delay_category: { name: 'Operator Unavailable' },
              },
              {
                // Draft entries and soft-deleted rows must not reach the sheet.
                status: 'draft',
                duration_hours: 2,
                manual_duration_hours: null,
                is_manual_override: false,
                description: 'Draft — ignore',
                deleted_at: null,
                delay_category: { name: 'Breakdown' },
              },
              {
                status: 'committed',
                duration_hours: 3,
                manual_duration_hours: null,
                is_manual_override: false,
                description: 'Deleted — ignore',
                deleted_at: '2026-06-15T10:00:00Z',
                delay_category: { name: 'Natural' },
              },
            ],
          },
        ],
        excavatorActs: [],
        dozerRolls: [],
        hourlyLoads: [{ machine_id: 'm-1', total_loads: 12 }],
        breakdowns: [
          // Resolved by serial number, 1h shift delay.
          { id: 'b-1', fleet_id: 'SN-101', reason: 'Hydraulic leak', delay_hours: 1 },
        ],
      });

      const res = await getShiftCompleteness(
        supabase,
        'dept-1',
        'control-room',
        '2026-06-15',
        'day'
      );

      const sheet = res.statuses[0]!;
      expect(sheet.operatorName).toBe('A. Mokoena');
      expect(sheet.smrStart).toBe(1200);
      expect(sheet.smrStop).toBe(1209.5);
      expect(sheet.comment).toBe('Bench 4 blast window · Waiting for operator');
      expect(sheet.delayMinutes).toEqual({
        blasting: 30,
        natural: 0,
        noOperator: 75,
        otherProduction: 0,
        greasingStartup: 0,
        maintenanceGet: 0,
        breakdown: 60,
      });
    });

    it('derives operator and SMR start from the earliest operation, SMR stop from the latest', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: 'm-1',
            name: 'DT-101',
            machine_type: 'dump truck',
            report_exempt: false,
          },
        ],
        machineOps: [
          {
            machine_id: 'm-1',
            hours_worked: 4,
            operator_name: null,
            start_time: '14:00:00',
            created_at: '2026-06-15T14:00:00Z',
            start_smu: 1300,
            end_smu: 1304,
            operator: { full_name: 'B. Later' },
            delay_entries: [],
          },
          {
            machine_id: 'm-1',
            hours_worked: 4,
            operator_name: null,
            start_time: '06:00:00',
            created_at: '2026-06-15T06:00:00Z',
            start_smu: 1200,
            end_smu: 1296,
            operator: { full_name: 'A. Earlier' },
            delay_entries: [],
          },
        ],
        excavatorActs: [],
        dozerRolls: [],
        hourlyLoads: [{ machine_id: 'm-1', total_loads: 12 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        'dept-1',
        'control-room',
        '2026-06-15',
        'day'
      );

      const sheet = res.statuses[0]!;
      expect(sheet.operatorName).toBe('A. Earlier');
      expect(sheet.smrStart).toBe(1200);
      expect(sheet.smrStop).toBe(1304);
    });

    it('throws instead of falling back when a query fails', async () => {
      const supabase = mockSupabaseBuilder(
        {
          machines: [],
          machineOps: [],
          excavatorActs: [],
          dozerRolls: [],
          hourlyLoads: [],
        },
        { failTable: 'machine_operations' }
      );

      await expect(
        getShiftCompleteness(supabase, 'dept-1', 'control-room', '2026-06-15', 'day')
      ).rejects.toThrow('Failed to load machine_operations for shift completeness');
    });

    it('includes the department slug in the cache key parts', async () => {
      const supabase = mockSupabaseBuilder({
        machines: [],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [],
        hourlyLoads: [],
      });
      const { withCache } = jest.requireMock('@/lib/cache-utils');
      withCache.mockClear();

      await getShiftCompleteness(supabase, 'dept-1', 'control-room', '2026-06-15', 'day');

      expect(withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          keyParts: ['dept-1', 'control-room', '2026-06-15', 'day'],
        })
      );
    });
  });
});
