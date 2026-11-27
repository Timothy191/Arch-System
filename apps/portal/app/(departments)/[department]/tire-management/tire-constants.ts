/* cspell:ignore Maxam Pirelli Sailun Trelleborg */
import { z } from 'zod';

export const TIRE_POSITIONS = [
  'Front Left',
  'Front Right',
  'Rear Inner Left',
  'Rear Outer Left',
  'Rear Inner Right',
  'Rear Outer Right',
] as const;

export const TIRE_ACTIVITY_MODES = ['replace', 'remove', 'install', 'inspect'] as const;
export const TIRE_CONDITION_STATUSES = ['good', 'warning', 'critical'] as const;
export const TIRE_REMOVED_OUTCOMES = ['inventory', 'scrapped'] as const;
export const TIRE_REPAIR_STATUS_OPTIONS = ['scrap', 'repaired', 'in_stock'] as const;
export type TireRepairStatusOption = (typeof TIRE_REPAIR_STATUS_OPTIONS)[number];
export const TIRE_ACTIVITY_REASON_PRESETS = [
  'Sidewall Cut',
  'Tread Worn',
  'Punctured / Blowout',
  'Scheduled Rotation',
  'New Mount / Book-In',
  'Routine Inspection',
] as const;

export const TIRE_MAKES = [
  'Michelin',
  'Bridgestone',
  'Goodyear',
  'Continental',
  'Pirelli',
  'Yokohama',
  'Trelleborg',
  'BKT',
  'Maxam',
  'Triangle',
  'Double Coin',
  'Sailun',
  'Other',
] as const;

export const WHEELED_MACHINE_TYPES = [
  'Dump Truck',
  'Grader',
  'Loader',
  'Water Truck',
  'Light Vehicle',
  'Compactor',
] as const;

const WHEELED_TYPE_TOKENS = [
  'dump truck',
  'dumper',
  'dump_truck',
  'adt',
  'rdt',
  'grader',
  'loader',
  'water',
  'bowser',
  'light vehicle',
  'compactor',
  'roller',
] as const;

const TRACKED_TYPE_TOKENS = [
  'dozer',
  'excavator',
  'drill',
  'crusher',
  'screen',
  'conveyor',
  'pump',
  'generator',
  'rig',
] as const;

export type VehicleLayoutKey = 'ADT' | 'RDT' | 'Grader' | 'Compactor';

export function isWheeledMachine(machine: {
  readonly machine_type: string;
  readonly name: string;
}): boolean {
  const haystack = `${machine.machine_type} ${machine.name}`.toLowerCase();
  if (TRACKED_TYPE_TOKENS.some((token) => haystack.includes(token))) {
    return false;
  }
  return WHEELED_TYPE_TOKENS.some((token) => haystack.includes(token));
}

export function resolveVehicleLayout(
  machine?: {
    readonly machine_type?: string | null;
    readonly name?: string | null;
  } | null
): VehicleLayoutKey {
  const haystack = `${machine?.machine_type ?? ''} ${machine?.name ?? ''}`.toLowerCase();
  if (haystack.includes('compactor') || haystack.includes('roller')) return 'Compactor';
  if (haystack.includes('grader')) return 'Grader';
  if (haystack.includes('articulated') || haystack.includes('adt')) return 'ADT';
  return 'RDT';
}

export const CRITICAL_TREAD_DEPTH_MM = 15;
export const WARNING_TREAD_DEPTH_MM = 22;
export const TIRE_ACTIVITY_RATE_LIMIT = 20;
export const TIRE_ACTIVITY_WINDOW_MS = 60_000;

export const ALLOWED_TIRE_ACTIVITY_ROLES: ReadonlySet<string> = new Set([
  'admin',
  'engineering',
  'supervisor',
  'manager',
]);

export type TireActivityMode = (typeof TIRE_ACTIVITY_MODES)[number];
export type TireConditionStatus = (typeof TIRE_CONDITION_STATUSES)[number];
export type TireRemovedOutcome = (typeof TIRE_REMOVED_OUTCOMES)[number];
export type TireActivityType = 'removal' | 'replacement' | 'installation' | 'inspection';

export interface TireMachineOption {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
  readonly starting_smr?: number | null;
  readonly latest_smu?: number | null;
  readonly manufacturer?: string | null;
  readonly image_url?: string | null;
  readonly site_name?: string | null;
  readonly site_code?: string | null;
}

export interface TireLatestInspection {
  readonly id: string;
  readonly tire_id: string;
  readonly inspection_date: string;
  readonly tread_depth_mm: number;
  readonly pressure_psi: number;
  readonly condition_status: string;
  readonly current_smu?: number | null;
  readonly notes: string | null;
}

export interface TireRecord {
  readonly id: string;
  readonly serial_number: string;
  readonly brand: string;
  readonly size: string;
  readonly position: string | null;
  readonly status: 'installed' | 'inventory' | 'scrapped' | string;
  readonly machine_id?: string | null;
  readonly machineName: string;
  readonly installed_at: string | null;
  readonly installed_hours: number | null;
  readonly removed_at?: string | null;
  readonly removed_hours?: number | null;
  readonly scrapped_reason?: string | null;
  readonly latestInspection?: TireLatestInspection;
}

export interface TireInspectionActivity {
  readonly id: string;
  readonly tire_id: string;
  readonly serial_number: string;
  readonly brand: string;
  readonly size: string;
  readonly machineName: string;
  readonly position: string;
  readonly inspection_date: string;
  readonly tread_depth_mm: number;
  readonly pressure_psi: number;
  readonly condition_status: string;
  readonly current_smu: number | null;
  readonly notes: string | null;
  readonly activityType: TireActivityType;
}

const DATE_YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateRemovalRequirements(
  val: {
    mode: TireActivityMode;
    machineId: string;
    removedTireId?: string;
    tireSerial?: string;
    tireBrand?: string;
    replacementSerial?: string;
    replacementBrand?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!val.machineId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['machineId'],
      message: 'Machine selection is required for tire removal or replacement',
    });
  }
  if (!val.removedTireId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['removedTireId'],
      message: 'Select the installed tire being removed',
    });
  }
  if (val.mode === 'remove') {
    const resolvedSerial = val.tireSerial?.trim() || val.replacementSerial?.trim();
    if (!resolvedSerial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tireSerial'],
        message: 'Serial Number is required',
      });
    }
    const resolvedBrand = val.tireBrand?.trim() || val.replacementBrand?.trim();
    if (!resolvedBrand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tireBrand'],
        message: 'Brand is required',
      });
    }
  }
}

function validateInstallationRequirements(
  val: {
    machineId: string;
    existingSpareTireId?: string;
    tireSerial?: string;
    tireBrand?: string;
    replacementSerial?: string;
    replacementBrand?: string;
    replacementSize?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!val.machineId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['machineId'],
      message: 'Machine selection is required for tire installation',
    });
  }
  const resolvedSerial = val.replacementSerial?.trim() || val.tireSerial?.trim();
  if (!resolvedSerial) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementSerial'],
      message: 'Serial Number is required',
    });
  }
  const resolvedBrand = val.replacementBrand?.trim() || val.tireBrand?.trim();
  if (!resolvedBrand) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementBrand'],
      message: 'Brand is required',
    });
  }
  if (val.existingSpareTireId) {
    return;
  }
  if (!val.replacementSize?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementSize'],
      message: 'Replacement size is required when registering a new tire',
    });
  }
}

function validateInspectionRequirements(
  val: {
    tireId?: string;
    removedTireId?: string;
    existingSpareTireId?: string;
    tireSerial?: string;
    tireBrand?: string;
    replacementSerial?: string;
    replacementBrand?: string;
    treadDepthMm?: number;
    pressurePsi?: number;
  },
  ctx: z.RefinementCtx
): void {
  const targetId = val.tireId || val.removedTireId || val.existingSpareTireId;
  if (!targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['removedTireId'],
      message: 'Select a tire to log an inspection',
    });
  }
  const resolvedSerial = val.tireSerial?.trim() || val.replacementSerial?.trim();
  if (!resolvedSerial) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tireSerial'],
      message: 'Serial Number is required',
    });
  }
  const resolvedBrand = val.tireBrand?.trim() || val.replacementBrand?.trim();
  if (!resolvedBrand) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tireBrand'],
      message: 'Brand is required',
    });
  }
  if (val.treadDepthMm === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['treadDepthMm'],
      message: 'Tread depth (mm) is required for an inspection',
    });
  }
  if (val.pressurePsi === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pressurePsi'],
      message: 'Pressure (PSI) is required for an inspection',
    });
  }
}

export interface TyreSwapSideDetails {
  readonly serial?: string;
  readonly size?: string;
  readonly make?: string;
  readonly tra?: number;
  readonly treadDepth?: number;
  readonly remainInSite?: boolean;
  readonly scrap?: boolean;
  readonly repair?: boolean;
  readonly isNew?: boolean;
  readonly repaired?: boolean;
}

export interface TyreSwapDetails {
  readonly jobCardNumber?: string;
  readonly off?: TyreSwapSideDetails;
  readonly on?: TyreSwapSideDetails;
}

const tyreSwapSideSchema = z.object({
  serial: z.string().trim().max(120).optional(),
  size: z.string().trim().max(120).optional(),
  make: z.string().trim().max(120).optional(),
  tra: z.coerce.number().min(0, 'TRA must be >= 0').max(200, 'TRA cannot exceed 200').optional(),
  treadDepth: z.coerce
    .number()
    .min(0, 'Tread depth must be >= 0 mm')
    .max(150, 'Tread depth cannot exceed 150 mm')
    .optional(),
  remainInSite: z.boolean().optional().default(false),
  scrap: z.boolean().optional().default(false),
  repair: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  repaired: z.boolean().optional().default(false),
});

const tyreSwapSchema = z
  .object({
    jobCardNumber: z.string().trim().max(60).optional(),
    off: tyreSwapSideSchema.optional(),
    on: tyreSwapSideSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.off?.scrap && val.off.remainInSite) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tyreSwap', 'off', 'scrap'],
        message: 'A tyre cannot both remain in site and be scrapped',
      });
    }
    if (val.on?.isNew && val.on.repaired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tyreSwap', 'on', 'repaired'],
        message: 'A mounted tyre is either new or repaired, not both',
      });
    }
  });

export const tireActivitySchema = z
  .object({
    mode: z.enum(TIRE_ACTIVITY_MODES),
    machineId: z.string().trim().optional().default(''),
    position: z.string().trim().min(1, 'Wheel position is required'),
    actionDate: z
      .string()
      .regex(DATE_YYYY_MM_DD_REGEX, 'Action date must follow YYYY-MM-DD format'),
    machineHours: z.preprocess(
      (rawVal) => (rawVal === '' || rawVal === null || rawVal === undefined ? Number.NaN : rawVal),
      z.coerce
        .number({ message: 'Machine hours (SMU) is required' })
        .int('Machine hours must be a whole number')
        .min(0, 'Machine hours must be >= 0')
    ),
    tireId: z.string().trim().optional(),
    removedTireId: z.string().trim().optional(),
    removedOutcome: z.enum(TIRE_REMOVED_OUTCOMES).default('inventory'),
    removedReason: z
      .string({ message: 'Reason is required (min 3 characters)' })
      .trim()
      .min(3, 'Reason is required (min 3 characters)')
      .max(500),
    tireSerial: z.string().trim().max(120).optional(),
    tireBrand: z.string().trim().max(120).optional(),
    replacementSerial: z.string().trim().max(120).optional(),
    replacementBrand: z.string().trim().max(120).optional(),
    replacementSize: z.string().trim().max(120).optional(),
    existingSpareTireId: z.string().trim().optional(),
    treadDepthMm: z.coerce
      .number()
      .min(0, 'Tread depth must be >= 0 mm')
      .max(150, 'Tread depth cannot exceed 150 mm')
      .optional(),
    pressurePsi: z.coerce
      .number()
      .min(0, 'Pressure must be >= 0 PSI')
      .max(250, 'Pressure cannot exceed 250 PSI')
      .optional(),
    conditionStatus: z.enum(TIRE_CONDITION_STATUSES).default('good'),
    notes: z.string().trim().max(1000).optional(),
    tyreSwap: tyreSwapSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'remove' || val.mode === 'replace') {
      validateRemovalRequirements(val, ctx);
    }
    if (val.mode === 'replace' || val.mode === 'install') {
      validateInstallationRequirements(val, ctx);
    }
    if (val.mode === 'inspect') {
      validateInspectionRequirements(val, ctx);
    }
  });

export type LogTireActivityInput = z.input<typeof tireActivitySchema>;
export type ParsedTireActivityInput = z.output<typeof tireActivitySchema>;

export interface LogTireActivityResult {
  readonly success: true;
  readonly mode: TireActivityMode;
  readonly removedTireId: string | null;
  readonly installedTireId: string | null;
  readonly inspectedTireId: string | null;
  readonly machineName: string;
}

export function buildTireActivityNote(options: {
  readonly prefix: '[REMOVAL]' | '[REPLACEMENT]' | '[INSTALLATION]' | '[INSPECTION]';
  readonly machineName: string;
  readonly position: string;
  readonly machineHours: number;
  readonly serialNumber?: string;
  readonly brand?: string;
  readonly outcome?: TireRemovedOutcome;
  readonly reason?: string;
  readonly treadDepthMm?: number;
  readonly pressurePsi?: number;
  readonly notes?: string;
  readonly swap?: TyreSwapDetails;
}): string {
  const segments = [
    `${options.prefix} Machine: ${options.machineName}`,
    `Position: ${options.position}`,
    `Serial: ${options.serialNumber?.trim() || 'Recorded'}`,
    `Brand: ${options.brand?.trim() || 'Recorded'}`,
    `Hours: ${options.machineHours}h`,
  ];

  if (options.outcome) {
    segments.push(`Outcome: ${options.outcome}`);
  }
  if (options.reason?.trim()) {
    segments.push(`Reason: ${options.reason.trim()}`);
  }
  if (options.treadDepthMm !== undefined) {
    segments.push(`Tread: ${options.treadDepthMm}mm`);
  }
  if (options.pressurePsi !== undefined) {
    segments.push(`PSI: ${options.pressurePsi}`);
  }
  if (options.notes?.trim()) {
    segments.push(`Notes: ${options.notes.trim()}`);
  }
  if (options.swap) {
    segments.push(...buildTyreSwapSegments(options.swap));
  }

  return segments.join(' | ');
}

function buildTyreSwapSegments(swap: TyreSwapDetails): string[] {
  const segments: string[] = [];
  if (swap.jobCardNumber?.trim()) {
    segments.push(`Job: ${swap.jobCardNumber.trim()}`);
  }
  const off = swap.off;
  if (off) {
    if (off.serial?.trim()) segments.push(`SerialOff: ${off.serial.trim()}`);
    if (off.size?.trim()) segments.push(`SizeOff: ${off.size.trim()}`);
    if (off.make?.trim()) segments.push(`MakeOff: ${off.make.trim()}`);
    if (off.tra !== undefined) segments.push(`TRAOff: ${off.tra}`);
    if (off.treadDepth !== undefined) segments.push(`TreadOff: ${off.treadDepth}mm`);
    const disposition = [
      off.remainInSite ? 'Remain in Site' : null,
      off.scrap ? 'Scrap' : null,
      off.repair ? 'Repair' : null,
    ].filter(Boolean);
    if (disposition.length > 0) segments.push(`TyreOff: ${disposition.join(', ')}`);
  }
  const on = swap.on;
  if (on) {
    if (on.serial?.trim()) segments.push(`SerialOn: ${on.serial.trim()}`);
    if (on.size?.trim()) segments.push(`SizeOn: ${on.size.trim()}`);
    if (on.make?.trim()) segments.push(`MakeOn: ${on.make.trim()}`);
    if (on.tra !== undefined) segments.push(`TRAOn: ${on.tra}`);
    if (on.treadDepth !== undefined) segments.push(`TreadOn: ${on.treadDepth}mm`);
    const condition = [on.isNew ? 'New' : null, on.repaired ? 'Repaired' : null].filter(Boolean);
    if (condition.length > 0) segments.push(`TyreOn: ${condition.join(', ')}`);
  }
  return segments;
}

/**
 * Parses the immutable ledger note string written by {@link buildTireActivityNote}
 * into ordered key/value pairs. Unknown or malformed segments are ignored.
 */
export function parseTireActivityNote(notes: string | null | undefined): Map<string, string> {
  const parsed = new Map<string, string>();
  const normalized = (notes ?? '').trim();
  if (!normalized) return parsed;
  const [prefixSegment, ...rest] = normalized.split(' | ');
  const prefixMatch = prefixSegment?.match(/^\[[A-Z]+\] Machine: (.*)$/);
  if (prefixMatch?.[1]) {
    parsed.set('Machine', prefixMatch[1]);
  }
  for (const segment of rest) {
    const separatorIndex = segment.indexOf(': ');
    if (separatorIndex <= 0) continue;
    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 2).trim();
    if (key && value) parsed.set(key, value);
  }
  return parsed;
}

export function classifyTireActivityType(notes: string | null | undefined): TireActivityType {
  const normalized = (notes ?? '').trim().toUpperCase();
  if (normalized.startsWith('[REMOVAL]')) return 'removal';
  if (normalized.startsWith('[REPLACEMENT]')) return 'replacement';
  if (normalized.startsWith('[INSTALLATION]')) return 'installation';
  return 'inspection';
}

export const tireRepairUpdateSchema = z
  .object({
    tireId: z.string().trim().min(1, 'Tire ID is required'),
    machineId: z.string().trim().max(120).optional().default(''),
    serialNumber: z.string().trim().min(1, 'Serial Number is required').max(120),
    dateOut: z.string().regex(DATE_YYYY_MM_DD_REGEX, 'Date out must follow YYYY-MM-DD format'),
    dateIn: z
      .union([
        z.literal(''),
        z.string().regex(DATE_YYYY_MM_DD_REGEX, 'Date in must follow YYYY-MM-DD format'),
      ])
      .optional()
      .default(''),
    reason: z.string().trim().min(2, 'Reason is required').max(300),
    comment: z.string().trim().max(500).optional().default(''),
    status: z.enum(TIRE_REPAIR_STATUS_OPTIONS),
    serviceProvider: z.string().trim().max(160).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.dateIn && val.dateOut && val.dateIn < val.dateOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateIn'],
        message: 'Date in cannot be earlier than Date out',
      });
    }
  });

export type UpdateTireRepairStatusInput = z.input<typeof tireRepairUpdateSchema>;

export interface UpdateTireRepairStatusResult {
  readonly success: true;
  readonly tireId: string;
  readonly status: TireRepairStatusOption;
}
