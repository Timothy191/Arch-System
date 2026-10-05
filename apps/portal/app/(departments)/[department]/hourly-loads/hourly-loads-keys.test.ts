import {
  buildHourlyLoadsGroupedMap,
  buildHourlyLoadsMap,
  type HourlyLoad,
  isHourEditable,
  sumHourlyTotal,
} from './loads-utils';

/** Regression: day/night rows must not overwrite each other in the grid map. */
describe('hourly loads helpers', () => {
  it('keeps day and night rows for the same machine as separate map entries', () => {
    const map = buildHourlyLoadsMap([
      {
        id: 'd1',
        machine_id: 'm1',
        shift_type: 'day',
        hour_01: 10,
        hour_12: 0,
        total_loads: 10,
      } as HourlyLoad,
      {
        id: 'n1',
        machine_id: 'm1',
        shift_type: 'night',
        hour_01: 20,
        hour_12: 0,
        total_loads: 20,
      } as HourlyLoad,
    ]);

    expect(map.get('m1:day')?.id).toBe('d1');
    expect(map.get('m1:night')?.id).toBe('n1');
    expect(map.size).toBe(2);
  });

  it('sums the twelve hour columns to mirror the DB generated total', () => {
    const load = {
      hour_01: 1,
      hour_02: 2,
      hour_03: 3,
      hour_04: 4,
      hour_05: 5,
      hour_06: 6,
      hour_07: 7,
      hour_08: 8,
      hour_09: 9,
      hour_10: 10,
      hour_11: 11,
      hour_12: 12,
    };
    expect(sumHourlyTotal(load)).toBe(78);
  });

  it('ignores non-hour fields when summing the total', () => {
    const load = {
      hour_01: 5,
      hour_12: 7,
      total_loads: 0,
      machine_id: 'm1',
      shift_type: 'day',
      id: 'x',
      excavator_id: 'excavator-1',
    };
    expect(sumHourlyTotal(load)).toBe(12);
  });

  it('supports excavator_id in HourlyLoad mapping', () => {
    const map = buildHourlyLoadsMap([
      {
        id: 'd1',
        machine_id: 'm1',
        shift_type: 'day',
        hour_01: 1,
        total_loads: 1,
        excavator_id: 'excavator-101',
      } as HourlyLoad,
    ]);

    expect(map.get('m1:day')?.excavator_id).toBe('excavator-101');
  });

  it('groups multiple split segments for the same machine and shift', () => {
    const grouped = buildHourlyLoadsGroupedMap([
      {
        id: 'seg-1',
        machine_id: 'm1',
        shift_type: 'day',
        start_hour: 1,
        end_hour: 9,
        is_locked: true,
        excavator_id: 'ex-1',
        material_type: 'Waste',
        hour_01: 5,
        total_loads: 5,
      } as HourlyLoad,
      {
        id: 'seg-2',
        machine_id: 'm1',
        shift_type: 'day',
        start_hour: 10,
        end_hour: 12,
        is_locked: false,
        excavator_id: 'ex-2',
        material_type: 'Coal',
        hour_10: 8,
        total_loads: 8,
      } as HourlyLoad,
    ]);

    const segments = grouped.get('m1:day');
    expect(segments).toHaveLength(2);
    expect(segments?.[0]?.id).toBe('seg-1');
    expect(segments?.[1]?.id).toBe('seg-2');
  });

  it('correctly validates editable hours and locks previous hours from double work', () => {
    const lockedPreviousSegment: HourlyLoad = {
      id: 'seg-1',
      machine_id: 'm1',
      shift_type: 'day',
      start_hour: 1,
      end_hour: 9,
      is_locked: true,
      hour_01: 5,
      hour_02: 4,
      total_loads: 9,
    } as HourlyLoad;

    // Locked segment cannot be edited on any hour
    expect(isHourEditable(lockedPreviousSegment, 1)).toBe(false);
    expect(isHourEditable(lockedPreviousSegment, 9)).toBe(false);
    expect(isHourEditable(lockedPreviousSegment, 10)).toBe(false);

    const activeSplitSegment: HourlyLoad = {
      id: 'seg-2',
      machine_id: 'm1',
      shift_type: 'day',
      start_hour: 10,
      end_hour: 12,
      is_locked: false,
      hour_10: 0,
      total_loads: 0,
    } as HourlyLoad;

    // Newly added split segment CANNOT fill loads for hours worked previously (hours 1..9)
    for (let h = 1; h <= 9; h++) {
      expect(isHourEditable(activeSplitSegment, h)).toBe(false);
    }

    // Newly added split segment CAN fill loads starting from Hour 10 onwards
    expect(isHourEditable(activeSplitSegment, 10)).toBe(true);
    expect(isHourEditable(activeSplitSegment, 11)).toBe(true);
    expect(isHourEditable(activeSplitSegment, 12)).toBe(true);
  });
});
