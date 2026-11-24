import { sanitizeCsvCell } from '@/lib/api/csv-utils';

export interface FleetMachineRecord {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly manufacturer?: string | null;
  readonly serial_number: string | null;
  readonly image_url?: string | null;
  readonly starting_smr?: number | null;
  readonly bin_factor: number | null;
  readonly bin_factor_waste?: number | null;
  readonly bin_factor_coal?: number | null;
  readonly active: boolean;
  readonly report_exempt: boolean;
  readonly department_id: string;
  readonly site_id: string | null;
  readonly created_at: string;
  readonly department: { readonly display_name: string } | null;
  readonly site: { readonly name: string; readonly site_code: string } | null;
}

export interface FleetImagePreset {
  readonly url: string;
  readonly label: string;
}

export const FLEET_IMAGE_PRESETS: readonly FleetImagePreset[] = [
  { url: '/images/fleet/volvo-adt.webp', label: 'Volvo Articulated Dump Truck (ADT)' },
  { url: '/images/fleet/caterpillar-rdt.webp', label: 'Caterpillar Rigid Dump Truck (777E)' },
  { url: '/images/fleet/komatsu-rdt.webp', label: 'Komatsu Rigid Dump Truck (HD785)' },
  {
    url: '/images/fleet/caterpillar-dozer.webp',
    label: 'Caterpillar Crawler Dozer (D9R/D10T/D11T)',
  },
  { url: '/images/fleet/komatsu-dozer.webp', label: 'Komatsu Crawler Dozer (D65)' },
  { url: '/images/fleet/hitachi-excavator.webp', label: 'Hitachi Mining Excavator' },
  { url: '/images/fleet/komatsu-excavator.webp', label: 'Komatsu Mining Excavator (PC1250)' },
  { url: '/images/fleet/atlas-copco-drill.webp', label: 'Atlas Copco Rotary Drill Rig' },
  { url: '/images/fleet/volvo-loader.webp', label: 'Volvo Wheel Loader (L150H/L180H)' },
  { url: '/images/fleet/caterpillar-loader.webp', label: 'Caterpillar Wheel Loader (966H)' },
  { url: '/images/fleet/caterpillar-grader.webp', label: 'Caterpillar Motor Grader (16H/140K)' },
  { url: '/images/fleet/sany-grader.webp', label: 'Sany Motor Grader (200)' },
  { url: '/images/fleet/water-bowser.webp', label: 'Water Bowser Truck' },
  { url: '/images/fleet/service-bowser.webp', label: 'Service / Fuel Bowser (Toyota Hino 500)' },
  { url: '/images/fleet/mobile-crusher.webp', label: 'Mobile Jaw Crusher Plant' },
  { url: '/images/fleet/roller-compactor.webp', label: 'Vibratory Roller Compactor' },
] as const;

const FLEET_CODE_REGEX = /^[A-Z]{1,4}-\d+[A-Z0-9-]*$/i;

const DUMPER_TYPES = [
  'articulated dumper',
  'articulated dump truck',
  'rigid dumper',
  'rigid dump truck',
  'adt',
  'rdt',
  'dump truck',
  'dump_truck',
  'dumper',
  'hauler',
] as const;

export function isArticulatedOrRigidDumper(machineType: string): boolean {
  const lower = machineType.toLowerCase();
  return DUMPER_TYPES.some((token) => lower.includes(token));
}

/**
 * Separates Machine ID (fleet code such as BD-22, DT-102) from Machine Name
 * (equipment model such as Caterpillar D9R, Volvo A45G).
 */
export function resolveMachineIdentity(options: {
  readonly name: string;
  readonly serialNumber: string | null | undefined;
}): {
  readonly machineId: string;
  readonly machineName: string;
} {
  const rawName = options.name.trim();
  const rawSerial = (options.serialNumber ?? '').trim();

  if (FLEET_CODE_REGEX.test(rawName)) {
    return {
      machineId: rawName.toUpperCase(),
      machineName: rawSerial || rawName,
    };
  }

  if (rawSerial && FLEET_CODE_REGEX.test(rawSerial)) {
    return {
      machineId: rawSerial.toUpperCase(),
      machineName: rawName || rawSerial,
    };
  }

  return {
    machineId: rawName || rawSerial || '—',
    machineName: rawSerial || rawName || '—',
  };
}

export function resolveDefaultManufacturer(options: {
  readonly machineId: string;
  readonly machineName: string;
  readonly machineType: string;
  readonly manufacturer?: string | null;
}): string {
  const explicit = (options.manufacturer ?? '').trim();
  if (explicit) return explicit;

  const idUpper = options.machineId.toUpperCase();
  const modelLower = options.machineName.toLowerCase();
  const typeLower = options.machineType.toLowerCase();

  if (
    idUpper.startsWith('DT-') ||
    typeLower.includes('articulated') ||
    modelLower.startsWith('volvo') ||
    idUpper === 'FB-18' ||
    idUpper.startsWith('WB-')
  ) {
    return 'Volvo';
  }
  if (modelLower.startsWith('caterpillar')) return 'Caterpillar';
  if (modelLower.startsWith('komatsu')) return 'Komatsu';
  if (modelLower.startsWith('hitachi')) return 'Hitachi';
  if (modelLower.startsWith('atlas copco')) return 'Atlas Copco';
  if (modelLower.startsWith('sany')) return 'Sany';
  if (modelLower.startsWith('toyota hino')) return 'Toyota Hino';
  if (idUpper.startsWith('CR-')) return 'Metso';
  if (idUpper.startsWith('CKN-')) return 'BOMAG';
  return 'Heavy Fleet';
}

export function resolveDefaultMachineImage(options: {
  readonly machineType: string;
  readonly manufacturer?: string | null;
  readonly machineId: string;
  readonly imageUrl?: string | null;
}): string {
  const explicit = (options.imageUrl ?? '').trim();
  if (explicit) return explicit;

  const idUpper = options.machineId.toUpperCase();
  const mfgLower = (options.manufacturer ?? '').toLowerCase();
  const typeLower = options.machineType.toLowerCase();

  if (idUpper.startsWith('DT-') || typeLower.includes('articulated')) {
    return '/images/fleet/volvo-adt.webp';
  }
  if (idUpper.startsWith('WB-') || typeLower.includes('water')) {
    return '/images/fleet/water-bowser.webp';
  }
  if (idUpper === 'FB-16' || mfgLower.includes('toyota')) {
    return '/images/fleet/service-bowser.webp';
  }
  if (idUpper === 'FB-18') {
    return '/images/fleet/volvo-adt.webp';
  }
  if (idUpper.startsWith('CR-') || typeLower.includes('crusher')) {
    return '/images/fleet/mobile-crusher.webp';
  }
  if (idUpper.startsWith('CKN-') || typeLower.includes('compactor')) {
    return '/images/fleet/roller-compactor.webp';
  }
  if (typeLower.includes('drill')) {
    return '/images/fleet/atlas-copco-drill.webp';
  }
  if (typeLower.includes('dozer')) {
    return mfgLower.includes('komatsu')
      ? '/images/fleet/komatsu-dozer.webp'
      : '/images/fleet/caterpillar-dozer.webp';
  }
  if (typeLower.includes('excavator')) {
    return mfgLower.includes('komatsu')
      ? '/images/fleet/komatsu-excavator.webp'
      : '/images/fleet/hitachi-excavator.webp';
  }
  if (typeLower.includes('grader')) {
    return mfgLower.includes('sany')
      ? '/images/fleet/sany-grader.webp'
      : '/images/fleet/caterpillar-grader.webp';
  }
  if (typeLower.includes('loader')) {
    return mfgLower.includes('caterpillar')
      ? '/images/fleet/caterpillar-loader.webp'
      : '/images/fleet/volvo-loader.webp';
  }
  if (typeLower.includes('dump') || typeLower.includes('rigid')) {
    return mfgLower.includes('komatsu')
      ? '/images/fleet/komatsu-rdt.webp'
      : '/images/fleet/caterpillar-rdt.webp';
  }
  return '/images/fleet/volvo-adt.webp';
}

const BASELINE_SMR_BY_TYPE: readonly (readonly [string, number])[] = [
  ['dozer', 14500],
  ['excavator', 12800],
  ['dump', 11400],
  ['drill', 9200],
  ['loader', 8600],
  ['grader', 7900],
  ['crusher', 6400],
  ['water', 5100],
  ['compactor', 3500],
];

export function estimateBaselineStartingSmr(options: {
  readonly machineType: string;
  readonly machineId: string;
}): number {
  const typeLower = options.machineType.toLowerCase();
  const baseMatch = BASELINE_SMR_BY_TYPE.find(([token]) => typeLower.includes(token));
  const baseHours = baseMatch ? baseMatch[1] : 4200;

  let hash = 0;
  for (let index = 0; index < options.machineId.length; index += 1) {
    hash = (hash * 31 + options.machineId.charCodeAt(index)) % 1500;
  }
  return Number((baseHours + hash).toFixed(1));
}

export interface FleetCategoryDatum {
  readonly label: string;
  readonly count: number;
  readonly activeCount: number;
}

export interface FleetSmrLeaderDatum {
  readonly machineId: string;
  readonly machineName: string;
  readonly startingSmr: number;
}

export interface FleetAnalyticsSummary {
  readonly totalMachines: number;
  readonly activeCount: number;
  readonly inactiveCount: number;
  readonly exemptCount: number;
  readonly availabilityPercent: number;
  readonly totalStartingSmr: number;
  readonly averageStartingSmr: number;
  readonly missingSmrCount: number;
  readonly manufacturerCount: number;
  readonly byType: readonly FleetCategoryDatum[];
  readonly byManufacturer: readonly FleetCategoryDatum[];
  readonly topSmrLeaders: readonly FleetSmrLeaderDatum[];
}

export function computeFleetAnalytics(
  machines: readonly FleetMachineRecord[]
): FleetAnalyticsSummary {
  const typeMap = new Map<string, { count: number; activeCount: number }>();
  const mfgMap = new Map<string, { count: number; activeCount: number }>();
  const leaders: FleetSmrLeaderDatum[] = [];

  let activeCount = 0;
  let exemptCount = 0;
  let totalStartingSmr = 0;
  let missingSmrCount = 0;

  for (const machine of machines) {
    if (machine.active) activeCount += 1;
    if (machine.report_exempt) exemptCount += 1;

    const smr = Number(machine.starting_smr ?? 0);
    if (Number.isFinite(smr) && smr > 0) {
      totalStartingSmr += smr;
    } else {
      missingSmrCount += 1;
    }

    const identity = resolveMachineIdentity({
      name: machine.name,
      serialNumber: machine.serial_number,
    });
    const mfgLabel = resolveDefaultManufacturer({
      machineId: identity.machineId,
      machineName: identity.machineName,
      machineType: machine.machine_type,
      manufacturer: machine.manufacturer,
    });

    const typeKey = machine.machine_type || 'Other';
    const prevType = typeMap.get(typeKey) ?? { count: 0, activeCount: 0 };
    typeMap.set(typeKey, {
      count: prevType.count + 1,
      activeCount: prevType.activeCount + (machine.active ? 1 : 0),
    });

    const prevMfg = mfgMap.get(mfgLabel) ?? { count: 0, activeCount: 0 };
    mfgMap.set(mfgLabel, {
      count: prevMfg.count + 1,
      activeCount: prevMfg.activeCount + (machine.active ? 1 : 0),
    });

    leaders.push({
      machineId: identity.machineId,
      machineName: identity.machineName,
      startingSmr: Number.isFinite(smr) ? smr : 0,
    });
  }

  const totalMachines = machines.length;
  const inactiveCount = totalMachines - activeCount;
  const availabilityPercent =
    totalMachines > 0 ? Math.round((activeCount / totalMachines) * 100) : 0;
  const averageStartingSmr =
    totalMachines > 0 ? Math.round((totalStartingSmr / totalMachines) * 10) / 10 : 0;

  const byType = Array.from(typeMap.entries())
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.count - a.count);

  const byManufacturer = Array.from(mfgMap.entries())
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.count - a.count);

  const topSmrLeaders = [...leaders].sort((a, b) => b.startingSmr - a.startingSmr).slice(0, 8);

  return {
    totalMachines,
    activeCount,
    inactiveCount,
    exemptCount,
    availabilityPercent,
    totalStartingSmr: Math.round(totalStartingSmr * 10) / 10,
    averageStartingSmr,
    missingSmrCount,
    manufacturerCount: byManufacturer.length,
    byType,
    byManufacturer,
    topSmrLeaders,
  };
}

export function buildFleetCsv(machines: readonly FleetMachineRecord[]): string {
  const headers = [
    'Machine ID',
    'Machine Name',
    'Machine Type',
    'Manufacturer',
    'Starting SMR (hrs)',
    'Department',
    'Site',
    'Status',
    'Image URL',
  ];
  const rows = machines.map((machine) => {
    const identity = resolveMachineIdentity({
      name: machine.name,
      serialNumber: machine.serial_number,
    });
    const mfg = resolveDefaultManufacturer({
      machineId: identity.machineId,
      machineName: identity.machineName,
      machineType: machine.machine_type,
      manufacturer: machine.manufacturer,
    });
    const imgUrl = resolveDefaultMachineImage({
      machineType: machine.machine_type,
      manufacturer: mfg,
      machineId: identity.machineId,
      imageUrl: machine.image_url,
    });
    return [
      identity.machineId,
      identity.machineName,
      machine.machine_type,
      mfg,
      machine.starting_smr != null ? String(machine.starting_smr) : '0',
      machine.department?.display_name || 'Production',
      machine.site ? `${machine.site.site_code} — ${machine.site.name}` : '',
      machine.active ? 'Active' : 'Inactive',
      imgUrl,
    ]
      .map((cell) => sanitizeCsvCell(cell))
      .join(',');
  });
  return [headers.map((h) => sanitizeCsvCell(h)).join(','), ...rows].join('\n');
}
