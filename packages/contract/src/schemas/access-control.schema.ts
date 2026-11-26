import { z } from 'zod';
import { dateSchema, nonEmptyString, uuidSchema } from './common.schema';

export const coalTruckScanSchema = z.object({
  truck_license: nonEmptyString.max(50, 'Truck license must be 50 characters or less'),
  driver_license: nonEmptyString.max(50, 'Driver license must be 50 characters or less'),
  gate_location: z.string().max(100).default('SOUTH-WEIGHBRIDGE'),
  direction: z.enum(['IN', 'OUT']).default('IN'),
  operator: z.string().max(100).optional().nullable(),
  device_id: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type CoalTruckScanInput = z.infer<typeof coalTruckScanSchema>;

export const keyControlAssetSchema = z.object({
  id: uuidSchema.optional(),
  key_code: nonEmptyString.max(50),
  key_name: nonEmptyString.max(150),
  key_type: z.enum([
    'heavy_fleet',
    'drill_rig',
    'personal_vehicle',
    'building',
    'explosives_depot',
    'workshop',
  ]),
  required_role: z.string().max(100).optional().nullable(),
  required_cert: z.string().max(150).optional().nullable(),
  department_id: uuidSchema.optional().nullable(),
  status: z.enum(['In Depot', 'Checked Out', 'Maintenance', 'Lost']).default('In Depot'),
  current_holder_id: uuidSchema.optional().nullable(),
  checked_out_at: z.string().datetime().optional().nullable(),
});

export type KeyControlAsset = z.infer<typeof keyControlAssetSchema>;

export const keyScanTransactionSchema = z.object({
  key_code: nonEmptyString,
  employee_badge_or_id: nonEmptyString,
  action: z.enum(['CHECKOUT', 'RETURN']).default('CHECKOUT'),
  gate_location: z.string().max(100).default('KEY-DEPOT-1'),
  device_id: z.string().max(100).optional().nullable(),
  operator: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type KeyScanTransactionInput = z.infer<typeof keyScanTransactionSchema>;

export const accessCardMakerSchema = z.object({
  first_name: nonEmptyString.max(100, 'First name is required'),
  surname: nonEmptyString.max(100, 'Surname is required'),
  id_number: nonEmptyString.max(50, 'National ID or Passport number is required'),
  job_role: nonEmptyString.max(100, 'Job role is required'),
  area: nonEmptyString.max(100, 'Operational area is required'),
  coy_number: nonEmptyString.max(50, 'Company number (Coy Number) is required'),
  medical_expiry: dateSchema.nullable().optional(),
  induction_expiry: dateSchema.nullable().optional(),
  photo_url: z.string().nullable().optional(),
  background_url: z.string().nullable().optional(),
  background_template: z.string().default('default-arch-card'),
  department_id: uuidSchema.optional().nullable(),
  print_copies: z.number().int().min(1).max(5).default(1),
  printer_cups_name: z.string().default('Magicard_Neo300'),
});

export type AccessCardMakerInput = z.infer<typeof accessCardMakerSchema>;

export const rollCallQuerySchema = z.object({
  department_id: uuidSchema.optional().nullable(),
  entity_type: z
    .enum(['all', 'personnel', 'contractor', 'visitor', 'vehicle', 'coal_truck'])
    .default('all'),
  zone: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
});

export type RollCallQueryInput = z.infer<typeof rollCallQuerySchema>;

export const attendanceQuerySchema = z.object({
  query: z.string().optional().nullable(),
  date_from: dateSchema.optional().nullable(),
  date_to: dateSchema.optional().nullable(),
  department_id: uuidSchema.optional().nullable(),
  direction: z.enum(['ALL', 'IN', 'OUT']).default('ALL').optional(),
  limit: z.number().int().min(1).max(500).default(100).optional(),
});

export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;

export const gateLocationSchema = z.object({
  id: uuidSchema.optional(),
  code: nonEmptyString.max(50),
  name: nonEmptyString.max(150),
  zone: nonEmptyString.max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  active_scanners: z.number().int().min(0).default(1),
  is_active: z.boolean().default(true),
});

export type GateLocation = z.infer<typeof gateLocationSchema>;

export const overstayAlertSchema = z.object({
  threshold_hours: z.number().min(1).max(24).default(13),
  notify_devices: z.boolean().default(true),
});

export type OverstayAlertInput = z.infer<typeof overstayAlertSchema>;

export const musterEventsSchema = z.object({
  id: uuidSchema.optional(),
  personnel_id: uuidSchema.optional().nullable(),
  employee_id: uuidSchema.optional().nullable(),
  badge_code: z.string().max(100).optional().nullable(),
  full_name: nonEmptyString.max(150),
  muster_point: z.string().max(150).default('Primary Assembly Point A'),
  status: z.enum(['accounted', 'missing', 'evacuated', 'medical']).default('accounted'),
  notes: z.string().max(500).optional().nullable(),
  recorded_by: uuidSchema.optional().nullable(),
});

export type MusterEventInput = z.infer<typeof musterEventsSchema>;

export const plantInventoryItemsSchema = z.object({
  id: uuidSchema.optional(),
  department_id: uuidSchema.optional().nullable(),
  stock: nonEmptyString.max(200),
  code: nonEmptyString.max(80),
  category: z.enum([
    'Dense Medium',
    'Reagents',
    'Wear Spares',
    'Screening & Crushing',
    'Stockpiles',
  ]),
  description: nonEmptyString.max(500),
  plant_equipment: nonEmptyString.max(150),
  unit: z.string().max(40).default('units'),
  amount_required: z.number().min(0),
  amount_present: z.number().min(0),
});

export type PlantInventoryItemInput = z.infer<typeof plantInventoryItemsSchema>;

export const plantInventoryUsageSchema = z.object({
  id: uuidSchema.optional(),
  item_id: uuidSchema.optional().nullable(),
  stock_code: nonEmptyString.max(80),
  stock_name: nonEmptyString.max(200),
  usage_date: dateSchema,
  shift: z.enum(['Day', 'Night']),
  amount_used: z.number().positive(),
  unit: z.string().max(40).default('units'),
  circuit_area: nonEmptyString.max(150),
  plant_equipment: nonEmptyString.max(150),
  description: z.string().max(500).default(''),
  logged_by: nonEmptyString.max(150),
});

export type PlantInventoryUsageInput = z.infer<typeof plantInventoryUsageSchema>;

export const plantHourlyLogsSchema = z.object({
  id: uuidSchema.optional(),
  department_id: uuidSchema.optional().nullable(),
  operation_date: dateSchema,
  shift: z.enum(['day', 'night']),
  module_id: nonEmptyString.max(50),
  operator_name: nonEmptyString.max(150),
  rows: z.array(z.record(z.string(), z.unknown())),
  total_rom_tonnes: z.number().min(0),
  total_clean_coal_tonnes: z.number().min(0),
  total_discard_tonnes: z.number().min(0),
  avg_yield_pct: z.number().min(0).max(100),
});

export type PlantHourlyLogInput = z.infer<typeof plantHourlyLogsSchema>;

export const plantDelaysSchema = z.object({
  id: uuidSchema.optional(),
  department_id: uuidSchema.optional().nullable(),
  delay_date: dateSchema,
  shift: z.enum(['day', 'night']),
  circuit: nonEmptyString.max(150),
  category: nonEmptyString.max(80),
  impact_type: nonEmptyString.max(80),
  start_time: nonEmptyString.max(10),
  end_time: z.string().max(10).optional().nullable(),
  duration_minutes: z.number().int().min(0).default(0),
  reason: nonEmptyString.max(500),
  corrective_action: z.string().max(500).default(''),
  logged_by: nonEmptyString.max(150),
  status: z.enum(['Active', 'Resolved']).default('Active'),
});

export type PlantDelayInput = z.infer<typeof plantDelaysSchema>;

const MAX_VISITOR_NAME_LENGTH = 100;
const MAX_VISITOR_COMPANY_LENGTH = 150;
const MAX_VISITOR_HOST_LENGTH = 150;
const MAX_VISITOR_REASON_LENGTH = 300;
const MAX_VISITOR_ID_NUMBER_LENGTH = 50;

const trimmedRequiredText = z.string().trim().min(1, 'Must not be empty');

export const visitorPassRequestSchema = z.object({
  first_name: trimmedRequiredText.max(
    MAX_VISITOR_NAME_LENGTH,
    'First name must be 100 characters or less'
  ),
  surname: trimmedRequiredText.max(
    MAX_VISITOR_NAME_LENGTH,
    'Surname must be 100 characters or less'
  ),
  company: trimmedRequiredText.max(
    MAX_VISITOR_COMPANY_LENGTH,
    'Company must be 150 characters or less'
  ),
  visiting: trimmedRequiredText.max(
    MAX_VISITOR_HOST_LENGTH,
    'Person or department visiting must be 150 characters or less'
  ),
  reason_for_entry: trimmedRequiredText.max(
    MAX_VISITOR_REASON_LENGTH,
    'Reason for visit must be 300 characters or less'
  ),
  id_number: z
    .string()
    .trim()
    .max(MAX_VISITOR_ID_NUMBER_LENGTH, 'ID or Passport number must be 50 characters or less')
    .optional()
    .nullable()
    .transform((rawIdNumber) => (rawIdNumber && rawIdNumber.length > 0 ? rawIdNumber : null)),
});

export type VisitorPassRequestInput = z.infer<typeof visitorPassRequestSchema>;

const GATE_ID_LENGTH = 64;
const GATE_REASON_LENGTH = 256;
const SCANNER_ID_LENGTH = 64;

export const gatePulseSchema = z.object({
  gateId: nonEmptyString.max(GATE_ID_LENGTH, 'Gate ID must be 64 characters or less'),
  reason: nonEmptyString.max(GATE_REASON_LENGTH, 'Pulse reason must be 256 characters or less'),
  scannerId: nonEmptyString
    .max(SCANNER_ID_LENGTH, 'Scanner ID must be 64 characters or less')
    .optional()
    .nullable(),
});

export type GatePulseInput = z.infer<typeof gatePulseSchema>;

export const gateDenialSchema = z.object({
  gateId: nonEmptyString.max(GATE_ID_LENGTH, 'Gate ID must be 64 characters or less'),
  badgeId: uuidSchema,
  reason: nonEmptyString.max(GATE_REASON_LENGTH, 'Denial reason must be 256 characters or less'),
});

export type GateDenialInput = z.infer<typeof gateDenialSchema>;

export const safeCupsNameRegex = /^[A-Za-z0-9._-]{1,64}$/;
export const safeJobNameRegex = /^[A-Za-z0-9._ -]{1,128}$/;
export const safePhotoUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (rawUrl) => {
      if (rawUrl.length === 0) return true;
      if (rawUrl.startsWith('/')) return !rawUrl.startsWith('//');
      try {
        const parsed = new URL(rawUrl);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Photo URL must be a valid HTTPS URL or relative storage path' }
  )
  .nullable()
  .optional();

export const musterStatusSchema = z.object({
  entityId: z.string().trim().min(1, 'Entity ID cannot be empty'),
  entityType: z.enum(['personnel', 'visitor']).default('personnel'),
  entityName: z.string().trim().min(1).max(150).optional(),
  status: z.enum(['accounted', 'unaccounted', 'evacuated']),
  station: z.string().max(150, 'Station name must be 150 characters or less').optional().nullable(),
  sessionId: z.string().trim().max(64).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

export type MusterStatusInput = z.infer<typeof musterStatusSchema>;

export const printCardRequestSchema = z.object({
  personnelId: uuidSchema,
  templateId: uuidSchema.optional().nullable(),
  printCopies: z.number().int().min(1).max(5).default(1),
});

export type PrintCardRequestInput = z.infer<typeof printCardRequestSchema>;

export const bulkPrintCardsSchema = z.object({
  personnelIds: z
    .array(uuidSchema)
    .min(1, 'Select at least one personnel record')
    .max(50, 'Bulk print batch cannot exceed 50 cards'),
  templateId: uuidSchema.optional().nullable(),
});

export type BulkPrintCardsInput = z.infer<typeof bulkPrintCardsSchema>;

export const registerPrinterSchema = z.object({
  cups_name: z
    .string()
    .trim()
    .regex(safeCupsNameRegex, 'CUPS printer name may only contain letters, digits, ., _, or -'),
  name: nonEmptyString.max(150, 'Printer display name must be 150 characters or less'),
  model: z.string().trim().max(100).default('Neo Magic 300'),
  connection_type: z.enum(['usb', 'network', 'cups']).default('usb'),
  vendor_id: z.string().trim().max(32).optional().nullable(),
  product_id: z.string().trim().max(32).optional().nullable(),
  device_path: z.string().trim().max(200).optional().nullable(),
});

export type RegisterPrinterInput = z.infer<typeof registerPrinterSchema>;

export const visitorApprovalSchema = z.object({
  visitorId: uuidSchema,
  reason: z.string().trim().max(256).optional(),
});

export type VisitorApprovalInput = z.infer<typeof visitorApprovalSchema>;

export const qrCreateEntityBadgeSchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('personnel'),
    firstName: nonEmptyString.max(100),
    surname: nonEmptyString.max(100),
    empCode: nonEmptyString.max(50),
    idNumber: nonEmptyString.max(50),
    jobTitle: z.string().trim().max(100).optional(),
  }),
  z.object({
    entityType: z.literal('visitor'),
    firstName: nonEmptyString.max(100),
    surname: nonEmptyString.max(100),
    company: nonEmptyString.max(150),
    idNumber: z.string().trim().max(50).optional().nullable(),
    visiting: z.string().trim().max(150).optional(),
    reasonForEntry: nonEmptyString.max(300),
  }),
  z.object({
    entityType: z.enum(['vehicle', 'coal_truck']),
    fleetCode: nonEmptyString.max(50),
    registrationNumber: z.string().trim().max(50).optional(),
    vehicleType: nonEmptyString.max(100),
    make: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
  }),
  z.object({
    entityType: z.literal('equipment'),
    equipCode: nonEmptyString.max(50),
    equipmentType: nonEmptyString.max(100),
    serialNumber: z.string().trim().max(100).optional(),
    manufacturer: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
  }),
]);

export type QrCreateEntityBadgeInput = z.infer<typeof qrCreateEntityBadgeSchema>;

/** Canonical contract schema matching `public.perimeter_gates` (migration 235). */
export const perimeterGatesSchema = z.object({
  id: nonEmptyString.max(64),
  name: nonEmptyString.max(150),
  gate_location: nonEmptyString.max(150),
  zone: nonEmptyString.max(150),
  gate_type: z
    .enum(['BOOM_BARRIER', 'TURNSTILE_ARRAY', 'WEIGHBRIDGE_BOOM', 'HIGH_SEC_PORTAL'])
    .default('BOOM_BARRIER'),
  interlock_active: z.boolean().default(false),
  is_maintenance: z.boolean().default(false),
  last_heartbeat_at: z.string().datetime().nullable().optional(),
  department_id: uuidSchema.nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type PerimeterGateRow = z.infer<typeof perimeterGatesSchema>;

export const gateHeartbeatSchema = z
  .object({
    gateId: nonEmptyString.max(GATE_ID_LENGTH, 'Gate ID must be 64 characters or less').optional(),
    gateLocation: nonEmptyString
      .max(150, 'Gate location must be 150 characters or less')
      .optional(),
    interlockActive: z.boolean().optional(),
    isMaintenance: z.boolean().optional(),
    faultMessage: z.string().trim().max(500).nullable().optional(),
    firmwareVersion: z.string().trim().max(64).optional(),
    timestamp: z.string().datetime().optional(),
  })
  .refine((payload) => Boolean(payload.gateId || payload.gateLocation), {
    message: 'Either gateId or gateLocation is required',
  });

export type GateHeartbeatInput = z.infer<typeof gateHeartbeatSchema>;
