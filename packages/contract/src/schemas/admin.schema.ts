import { z } from 'zod';

export const adminDataQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order_by: z.string().max(100).optional().default('created_at'),
  order_dir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const adminDataInsertSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => Object.keys(value).length > 0,
    'Insert payload must contain at least one field'
  );

export const adminDataUpdateSchema = z
  .object({ id: z.string().min(1, 'Record id is required') })
  .passthrough();

export const adminDataDeleteSchema = z.object({
  id: z.string().min(1, 'Record id is required'),
});

export const adminAddSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  site_code: z.string().min(1, 'Site code is required'),
  active: z.boolean().optional().default(true),
});

export const adminUpdateSiteSchema = z.object({
  name: z.string().min(1, 'Site name cannot be empty').optional(),
  site_code: z.string().min(1, 'Site code cannot be empty').optional(),
  active: z.boolean().optional(),
});

export const adminAddMineBlockSchema = z.object({
  name: z.string().min(1, 'Block name is required'),
  code: z.string().min(1, 'Block code is required'),
  site_id: z.string().uuid('Invalid site ID format').nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const adminUpdateMineBlockSchema = z.object({
  id: z.string().uuid('Invalid block ID format'),
  name: z.string().min(1, 'Block name cannot be empty').optional(),
  code: z.string().min(1, 'Block code cannot be empty').optional(),
  site_id: z.string().uuid('Invalid site ID format').nullable().optional(),
  active: z.boolean().optional(),
});

export const adminMineralRegistrySchema = z.object({
  waste: z.array(z.string().min(1)).min(1, 'At least one waste mineral is required'),
  coal: z.array(z.string().min(1)).min(1, 'At least one coal mineral is required'),
});

export type AdminMineralRegistry = z.infer<typeof adminMineralRegistrySchema>;

export const operationalTargetWindowSchema = z.object({
  loadsTarget: z.coerce.number().min(1, 'Loads target must be at least 1'),
  coalTonnesTarget: z.coerce.number().min(1, 'Coal tonnes target must be at least 1'),
  wasteTonnesTarget: z.coerce.number().min(1, 'Waste tonnes target must be at least 1'),
  volumeBcmTarget: z.coerce.number().min(1, 'Volume BCM target must be at least 1'),
  smrHoursTarget: z.coerce.number().min(1, 'SMR hours target must be at least 1'),
});

export const adminOperationalTargetsSchema = z.object({
  shift: operationalTargetWindowSchema,
  daily: operationalTargetWindowSchema,
  monthly: operationalTargetWindowSchema,
});

export type OperationalTargetWindow = z.infer<typeof operationalTargetWindowSchema>;
export type AdminOperationalTargets = z.infer<typeof adminOperationalTargetsSchema>;

export const employeeGenderSchema = z.enum(['male', 'female', 'other']);
export type EmployeeGender = z.infer<typeof employeeGenderSchema>;

export const employeeRecordTypeSchema = z.enum(['user', 'employee']);
export type EmployeeRecordType = z.infer<typeof employeeRecordTypeSchema>;

export const departmentPermissionSchema = z.object({
  read: z.boolean(),
  write: z.boolean(),
});
export type DepartmentPermission = z.infer<typeof departmentPermissionSchema>;

export const departmentPermissionsMapSchema = z.record(z.string(), departmentPermissionSchema);
export type DepartmentPermissionsMap = z.infer<typeof departmentPermissionsMapSchema>;

export const upsertAdminEmployeeSchema = z.object({
  id: z.string().nullable().optional(),
  record_type: employeeRecordTypeSchema.optional().default('employee'),
  names: z.string().max(120),
  surname: z.string().max(120),
  full_name: z.string().max(240),
  gender: employeeGenderSchema.or(z.literal('')).nullable().optional(),
  birthday: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Birthday must use YYYY-MM-DD format')
    .optional()
    .default(''),
  id_number: z.string().max(64),
  job_title: z.string().max(120),
  area: z.string().max(120),
  medical_expiry: z.string().max(32),
  induction_expiry: z.string().max(32),
  coy_number: z.string().max(64),
  qr_code: z.string().max(128),
  photo_url: z.string(),
  role: z.string().min(1).max(64),
  department_id: z.string().nullable(),
  accessible_departments: z.array(z.string()),
  department_permissions: departmentPermissionsMapSchema.optional().default({}),
});
export type UpsertAdminEmployeeSchemaInput = z.infer<typeof upsertAdminEmployeeSchema>;

export const adminAddDepartmentSchema = z.object({
  display_name: z.string().trim().min(1, 'Department name is required').max(120),
  name: z.string().trim().min(1).max(120).optional(),
});
export type AdminAddDepartmentInput = z.infer<typeof adminAddDepartmentSchema>;

export const adminArchiveDepartmentSchema = z.object({
  id: z.string().min(1, 'Department ID is required'),
});
export type AdminArchiveDepartmentInput = z.infer<typeof adminArchiveDepartmentSchema>;

export const adminCardTemplateUploadSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(120),
  isDefault: z.boolean().default(false),
});
export type AdminCardTemplateUploadInput = z.infer<typeof adminCardTemplateUploadSchema>;

export const adminCardTemplateIdSchema = z.object({
  id: z.string().min(1, 'Template ID is required'),
});
export type AdminCardTemplateIdInput = z.infer<typeof adminCardTemplateIdSchema>;
