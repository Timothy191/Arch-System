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
export const TIRE_ACTIVITY_REASON_PRESETS = [
  'Sidewall Cut',
  'Tread Worn',
  'Punctured / Blowout',
  'Scheduled Rotation',
  'New Mount / Book-In',
  'Routine Inspection',
] as const;

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

  return segments.join(' | ');
}

export function classifyTireActivityType(notes: string | null | undefined): TireActivityType {
  const normalized = (notes ?? '').trim().toUpperCase();
  if (normalized.startsWith('[REMOVAL]')) return 'removal';
  if (normalized.startsWith('[REPLACEMENT]')) return 'replacement';
  if (normalized.startsWith('[INSTALLATION]')) return 'installation';
  return 'inspection';
}
