import {
  buildFleetCsv,
  computeFleetAnalytics,
  estimateBaselineStartingSmr,
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
      resolveDefaultManufacturer({
        machineId: 'DR-03',
        machineName: 'Atlas Copco DM30',
        machineType: 'Drill Rig',
      })
    ).toBe('Atlas Copco');
    expect(
      resolveDefaultManufacturer({
        machineId: 'GR-05',
        machineName: 'Sany STG200',
        machineType: 'Grader',
      })
    ).toBe('Sany');
    expect(
      resolveDefaultManufacturer({
        machineId: 'FB-16',
        machineName: 'Toyota Hino 500',
        machineType: 'Service Truck',
      })
    ).toBe('Toyota Hino');
    expect(
      resolveDefaultManufacturer({
        machineId: 'CR-01',
        machineName: 'Jaw Crusher',
        machineType: 'Crusher',
      })
    ).toBe('Metso');
    expect(
      resolveDefaultManufacturer({
        machineId: 'CKN-01',
        machineName: 'Roller',
        machineType: 'Compactor',
      })
    ).toBe('BOMAG');

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
    expect(
      resolveDefaultMachineImage({
        machineType: 'Excavator',
        manufacturer: 'Hitachi',
        machineId: 'EX-14',
      })
    ).toBe('/images/fleet/hitachi-excavator.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Drill Rig',
        manufacturer: 'Atlas Copco',
        machineId: 'DR-03',
      })
    ).toBe('/images/fleet/atlas-copco-drill.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Loader',
        manufacturer: 'Caterpillar',
        machineId: 'WL-01',
      })
    ).toBe('/images/fleet/caterpillar-loader.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Grader',
        manufacturer: 'Sany',
        machineId: 'GR-05',
      })
    ).toBe('/images/fleet/sany-grader.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Water Truck',
        manufacturer: 'Volvo',
        machineId: 'WB-02',
      })
    ).toBe('/images/fleet/water-bowser.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Crusher',
        manufacturer: 'Metso',
        machineId: 'CR-01',
      })
    ).toBe('/images/fleet/mobile-crusher.webp');
    expect(
      resolveDefaultMachineImage({
        machineType: 'Compactor',
        manufacturer: 'BOMAG',
        machineId: 'CKN-01',
      })
    ).toBe('/images/fleet/roller-compactor.webp');

    expect(isArticulatedOrRigidDumper('Articulated Dumper')).toBe(true);
    expect(isArticulatedOrRigidDumper('Excavator')).toBe(false);
    expect(FLEET_IMAGE_PRESETS.length).toBeGreaterThanOrEqual(16);
  });

  it('computes analytics, baseline SMR estimates, and CSV injection-safe exports', () => {
    const summary = computeFleetAnalytics(MOCK_MACHINES);
    expect(summary.totalMachines).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.inactiveCount).toBe(1);
    expect(summary.availabilityPercent).toBe(50);
    expect(summary.missingSmrCount).toBe(1);
    expect(summary.manufacturerCount).toBe(2);

    const baseline = estimateBaselineStartingSmr({ machineType: 'Dozer', machineId: 'BD-22' });
    expect(baseline).toBeGreaterThanOrEqual(14500);

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
