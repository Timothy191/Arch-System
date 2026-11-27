import {
  buildExcavatorLoadTable,
  buildShiftDelayHoursMap,
  computeMaxStopSmr,
  filterExcavatorOperators,
  isExcavatorOperator,
  normalizeDelayHours,
  sortExcavatorsForLog,
  validateStopSmrCap,
} from './excavator-shift-helpers';

describe('excavator-shift-helpers', () => {
  describe('Stop SMR cap helpers', () => {
    it('normalizes delay hours into 0..12', () => {
      expect(normalizeDelayHours(null)).toBe(0);
      expect(normalizeDelayHours(undefined)).toBe(0);
      expect(normalizeDelayHours(Number.NaN)).toBe(0);
      expect(normalizeDelayHours(-3)).toBe(0);
      expect(normalizeDelayHours(2.5)).toBe(2.5);
      expect(normalizeDelayHours(18)).toBe(12);
    });

    it('computes max Stop SMR as startSmr + (12 - delayHours)', () => {
      expect(computeMaxStopSmr(null, 2)).toBeNull();
      expect(computeMaxStopSmr(14500, 0)).toBe(14512);
      expect(computeMaxStopSmr(14500, 2.5)).toBe(14509.5);
      expect(computeMaxStopSmr(14500.25, 1.5)).toBe(14510.75);
      expect(computeMaxStopSmr(14500, 15)).toBe(14500);
    });

    it('validates Stop SMR cap with descriptive error messages', () => {
      expect(validateStopSmrCap({ startSmr: 14500, stopSmr: null, delayHours: 2 })).toBeNull();
      expect(validateStopSmrCap({ startSmr: null, stopSmr: 14520, delayHours: 2 })).toBeNull();
      expect(validateStopSmrCap({ startSmr: 14500, stopSmr: 14510, delayHours: 2 })).toBeNull();
      expect(validateStopSmrCap({ startSmr: 14500, stopSmr: 14510.1, delayHours: 2 })).toBe(
        'Stop SMR cannot exceed 14510 (Start SMR + 12 h − 2 h delay).'
      );
    });

    it('aggregates shift delay hours per excavator and shift for today only', () => {
      const map = buildShiftDelayHoursMap(
        [
          {
            machine_id: 'ex-10',
            shift_date: '2026-11-24',
            shift_type: 'day',
            total_delay_hours: 1.5,
          },
          {
            machine_id: 'ex-10',
            shift_date: '2026-11-24',
            shift_type: 'day',
            total_delay_hours: 0.75,
          },
          {
            machine_id: 'ex-10',
            shift_date: '2026-11-24',
            shift_type: 'night',
            total_delay_hours: 3,
          },
          {
            machine_id: 'ex-10',
            shift_date: '2026-11-23',
            shift_type: 'day',
            total_delay_hours: 5,
          },
          { machine_id: null, shift_date: '2026-11-24', shift_type: 'day', total_delay_hours: 2 },
        ],
        '2026-11-24'
      );

      expect(map).toEqual({
        'ex-10|day': 2.25,
        'ex-10|night': 3,
      });
    });
  });

  describe('filterExcavatorOperators', () => {
    const operators = [
      { id: 'op-1', employee_code: 'EMP-101', role: 'Excavator Operator' },
      { id: 'op-2', employee_code: 'EMP-102', role: 'ADT Driver' },
      { id: 'op-3', employee_code: 'OP-EX-04', role: null },
      { id: 'op-4', employee_code: 'EMP-104', role: 'Dozer Operator' },
    ];

    it('detects excavator operators by role or OP-EX code', () => {
      expect(isExcavatorOperator(operators[0]!)).toBe(true);
      expect(isExcavatorOperator(operators[1]!)).toBe(false);
      expect(isExcavatorOperator(operators[2]!)).toBe(true);
      expect(isExcavatorOperator(operators[3]!)).toBe(false);
    });

    it('filters to excavator operators only', () => {
      expect(filterExcavatorOperators(operators).map((o) => o.id)).toEqual(['op-1', 'op-3']);
    });

    it('keeps a currently selected non-matching operator visible', () => {
      expect(filterExcavatorOperators(operators, 'op-2').map((o) => o.id)).toEqual([
        'op-2',
        'op-1',
        'op-3',
      ]);
    });

    it('falls back to all operators when no excavator operators exist', () => {
      const nonExcavator = [
        { id: 'op-2', employee_code: 'EMP-102', role: 'ADT Driver' },
        { id: 'op-4', employee_code: 'EMP-104', role: 'Dozer Operator' },
      ];
      expect(filterExcavatorOperators(nonExcavator).map((o) => o.id)).toEqual(['op-2', 'op-4']);
    });
  });

  describe('sortExcavatorsForLog', () => {
    it('moves Plant and Other excavators to the end while keeping relative order stable', () => {
      const excavators = [
        { id: 'ex-1' },
        { id: 'ex-2' },
        { id: 'ex-3' },
        { id: 'ex-4' },
        { id: 'ex-5' },
      ];
      const ordered = sortExcavatorsForLog(excavators, {
        'ex-1': 'Plant',
        'ex-2': 'Waste',
        'ex-3': 'Other',
        'ex-4': 'Coal',
        // ex-5 unassigned
      });

      expect(ordered.map((e) => e.id)).toEqual(['ex-2', 'ex-4', 'ex-5', 'ex-1', 'ex-3']);
    });
  });

  describe('buildExcavatorLoadTable', () => {
    const dumpers = [
      { id: 'dt-02', name: 'DT-02', bin_factor: 20 },
      { id: 'dt-01', name: 'DT-01', bin_factor: 25 },
      { id: 'dt-03', name: 'DT-03', bin_factor: null },
    ];

    it('aggregates hourly loads per machine, calculates BCM, and merges saved assignments without duplicates', () => {
      const table = buildExcavatorLoadTable({
        excavatorId: 'ex-10',
        shift: 'day',
        activityId: 'act-1',
        loads: [
          { machine_id: 'dt-01', excavator_id: 'ex-10', shift_type: 'day', total_loads: 4 },
          { machine_id: 'dt-01', excavator_id: 'ex-10', shift_type: 'day', total_loads: 2 },
          { machine_id: 'dt-01', excavator_id: 'ex-10', shift_type: 'night', total_loads: 9 },
          { machine_id: 'dt-03', excavator_id: 'ex-10', shift_type: 'day', total_loads: 3 },
        ],
        assignments: [
          {
            excavator_activity_id: 'act-1',
            dumper_machine_id: 'dt-01',
            total_loads: 99,
            total_bcm: 999,
          },
          {
            excavator_activity_id: 'act-1',
            dumper_machine_id: 'dt-02',
            total_loads: 5,
            total_bcm: 100,
          },
        ],
        dumpers,
      });

      expect(table.rows).toEqual([
        { machineId: 'dt-01', machineName: 'DT-01', loads: 6, totalMaterial: 150 },
        { machineId: 'dt-02', machineName: 'DT-02', loads: 5, totalMaterial: 100 },
        { machineId: 'dt-03', machineName: 'DT-03', loads: 3, totalMaterial: null },
      ]);
      expect(table.totalLoads).toBe(14);
      expect(table.totalMaterial).toBe(250);
    });

    it('returns empty rows and zero totals when no machines are assigned', () => {
      const table = buildExcavatorLoadTable({
        excavatorId: 'ex-10',
        shift: 'day',
        activityId: null,
        loads: [],
        assignments: [],
        dumpers,
      });

      expect(table).toEqual({ rows: [], totalLoads: 0, totalMaterial: 0 });
    });
  });
});
