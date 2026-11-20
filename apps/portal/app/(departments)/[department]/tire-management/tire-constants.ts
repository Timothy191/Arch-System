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

export type TirePosition = (typeof TIRE_POSITIONS)[number];
export type TireActivityMode = (typeof TIRE_ACTIVITY_MODES)[number];
export type TireConditionStatus = (typeof TIRE_CONDITION_STATUSES)[number];
export type TireRemovedOutcome = (typeof TIRE_REMOVED_OUTCOMES)[number];
export type TireActivityType = 'removal' | 'replacement' | 'installation' | 'inspection';

export interface TireMachineOption {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number: string | null;
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
    machineId: string;
    removedTireId?: string;
    removedOutcome: TireRemovedOutcome;
    removedReason?: string;
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
  if (val.removedOutcome === 'scrapped' && !val.removedReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['removedReason'],
      message: 'Removal reason is required when marking a tire as scrapped',
    });
  }
}

function validateInstallationRequirements(
  val: {
    machineId: string;
    existingSpareTireId?: string;
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
  if (val.existingSpareTireId) {
    return;
  }
  if (!val.replacementSerial?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementSerial'],
      message: 'Replacement serial number is required when not selecting an inventory spare',
    });
  }
  if (!val.replacementBrand?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementBrand'],
      message: 'Replacement brand is required when registering a new tire',
    });
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
    machineHours: z.coerce
      .number()
      .int('Machine hours must be a whole number')
      .min(0, 'Machine hours must be >= 0'),
    tireId: z.string().trim().optional(),
    removedTireId: z.string().trim().optional(),
    removedOutcome: z.enum(TIRE_REMOVED_OUTCOMES).default('inventory'),
    removedReason: z.string().trim().max(500).optional(),
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
  readonly outcome?: TireRemovedOutcome;
  readonly reason?: string;
  readonly treadDepthMm?: number;
  readonly pressurePsi?: number;
  readonly notes?: string;
}): string {
  const segments = [
    `${options.prefix} Machine: ${options.machineName}`,
    `Position: ${options.position}`,
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
