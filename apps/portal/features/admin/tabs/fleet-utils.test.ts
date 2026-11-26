import {
  buildFleetCsv,
  computeFleetAnalytics,
  FLEET_IMAGE_PRESETS,
  type FleetMachineRecord,
  isArticulatedOrRigidDumper,
  resolveDefaultMachineImage,
  resolveDefaultManufacturer,
  resolveMachineIdentity,
} from './fleet-utils';

const MOCK_MACHINES: readonly FleetMachineRecord[] = [
  {
    id: 'm-1',
    name: 'DT-102',
    machine_type: 'Articulated Dumper',
    manufacturer: null,
    serial_number: 'Volvo A45G',
    image_url: null,
    starting_smr: 11850,
    bin_factor: 18,
    bin_factor_waste: 18,
    bin_factor_coal: 22,
    active: true,
    report_exempt: false,
    department_id: 'dept-prod',
    site_id: 'site-1',
    created_at: '2026-01-01T00:00:00Z',
    department: { display_name: 'Production' },
    site: { name: 'Brakfontein Pit', site_code: 'BRAK' },
  },
  {
    id: 'm-2',
    name: 'BD-22',
    machine_type: 'Dozer',
    manufacturer: 'Caterpillar',
    serial_number: 'Caterpillar D9R',
    image_url: '/images/fleet/caterpillar-dozer.webp',
    starting_smr: 0,
    bin_factor: null,
    active: false,
    report_exempt: true,
    department_id: 'dept-prod',
    site_id: null,
    created_at: '2026-01-02T00:00:00Z',
    department: { display_name: 'Production' },
    site: null,
  },
];

describe('fleet-utils', () => {
  it('separates fleet code Machine ID from Machine Name model', () => {
    expect(resolveMachineIdentity({ name: 'BD-22', serialNumber: 'Caterpillar D9R' })).toEqual({
      machineId: 'BD-22',
      machineName: 'Caterpillar D9R',
    });

    expect(resolveMachineIdentity({ name: 'Caterpillar D9R', serialNumber: 'BD-22' })).toEqual({
      machineId: 'BD-22',
      machineName: 'Caterpillar D9R',
    });

    expect(resolveMachineIdentity({ name: 'Jaw Crusher', serialNumber: 'Primary Unit' })).toEqual({
      machineId: 'Jaw Crusher',
      machineName: 'Primary Unit',
    });
  });

  it('resolves manufacturers and OEM machine pictures consistently', () => {
    expect(
      resolveDefaultManufacturer({
        machineId: 'DT-102',
        machineName: 'Dump Truck 102',
        machineType: 'Articulated Dumper',
      })
    ).toBe('Volvo');
    expect(
      resolveDefaultManufacturer({
        machineId: 'BD-22',
        machineName: 'Caterpillar D9R',
        machineType: 'Dozer',
      })
    ).toBe('Caterpillar');
    expect(
      resolveDefaultManufacturer({
        machineId: 'EX-11',
        machineName: 'Komatsu PC1250',
        machineType: 'Excavator',
      })
    ).toBe('Komatsu');
    expect(
      resolveDefaultManufacturer({
        machineId: 'EX-14',
        machineName: 'Hitachi EX870',
        machineType: 'Excavator',
      })
    ).toBe('Hitachi');

    expect(
      resolveDefaultMachineImage({
        machineType: 'Articulated Dumper',
        manufacturer: 'Volvo',
        machineId: 'DT-102',
      })
    ).toBe('/images/fleet/volvo-adt.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Dozer',
        manufacturer: 'Komatsu',
        machineId: 'KD-04',
      })
    ).toBe('/images/fleet/komatsu-dozer.webp');

    expect(isArticulatedOrRigidDumper('Articulated Dumper')).toBe(true);
    expect(isArticulatedOrRigidDumper('Excavator')).toBe(false);
    expect(FLEET_IMAGE_PRESETS.length).toBeGreaterThanOrEqual(16);
  });

  it('computes analytics and CSV injection-safe exports without synthetic SMR fabrication', () => {
    const summary = computeFleetAnalytics(MOCK_MACHINES);
    expect(summary.totalMachines).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.inactiveCount).toBe(1);
    expect(summary.availabilityPercent).toBe(50);
    expect(summary.missingSmrCount).toBe(1);
    expect(summary.manufacturerCount).toBe(2);

    const csv = buildFleetCsv([
      {
        ...MOCK_MACHINES[0]!,
        serial_number: '=CMD|calc',
      },
    ]);
    expect(csv).toContain('"Machine ID","Machine Name","Machine Type"');
    expect(csv).toContain('"Volvo"');
    expect(csv).toContain('"\'=CMD|calc"');
  });
});
