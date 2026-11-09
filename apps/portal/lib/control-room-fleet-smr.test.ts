import {
  buildCloseoutFleetAllocations,
  resolveLatestMachineSmrMap,
} from './control-room-fleet-smr';

describe('control-room-fleet-smr helper', () => {
  it('resolves the highest opening SMR across machine_operations and smr_readings', () => {
    const previousSMRs = [
      { machine_id: 'm-1', end_smu: 1420.5 },
      { machine_id: 'm-1', end_smu: 1410.0 },
      { machine_id: 'm-2', end_smu: 800.2 },
    ];
    const baselineSmrReadings = [
      { meter_id: 'm-1', reading: 1415.0 },
      { meter_id: 'm-2', reading: 812.6 },
      { meter_id: 'm-3', reading: 310.0 },
    ];

    const smrMap = resolveLatestMachineSmrMap(previousSMRs, baselineSmrReadings);
    expect(smrMap.get('m-1')).toBe(1420.5);
    expect(smrMap.get('m-2')).toBe(812.6);
    expect(smrMap.get('m-3')).toBe(310.0);

    const allocations = buildCloseoutFleetAllocations(
      [
        { id: 'm-1', name: 'ADT 01' },
        { id: 'm-2', name: 'EX 02' },
        { id: 'm-4', name: 'DZ 01' },
      ],
      smrMap
    );

    expect(allocations).toEqual([
      {
        machine_id: 'm-1',
        machine_name: 'ADT 01',
        opening_smr: 1420.5,
        closing_smr: 1420.5,
        breakdown_hours: 0,
        delay_hours: 0,
      },
      {
        machine_id: 'm-2',
        machine_name: 'EX 02',
        opening_smr: 812.6,
        closing_smr: 812.6,
        breakdown_hours: 0,
        delay_hours: 0,
      },
      {
        machine_id: 'm-4',
        machine_name: 'DZ 01',
        opening_smr: 0,
        closing_smr: 0,
        breakdown_hours: 0,
        delay_hours: 0,
      },
    ]);
  });
});
