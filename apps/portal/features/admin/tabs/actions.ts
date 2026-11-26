'use server';

import {
  adminAddDepartmentSchema,
  adminDataQuerySchema,
  adminDeleteEmployeeSchema,
  type DepartmentPermission,
  type EmployeeGender,
  type EmployeeRecordType,
  upsertAdminEmployeeSchema,
} from '@repo/contract';
import { AuthError, DatabaseError, RateLimitError, ValidationError } from '@repo/errors';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { revokeSession } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath } from 'next/cache';
import { updateTags } from '@/lib/server-cache';
import { logAdminAuditEvent } from '../actions/shared';

type AdminSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const ADMIN_MUTATION_LIMIT = 30;
const ADMIN_MUTATION_WINDOW_MS = 60_000;
const DEFAULT_USERS_QUERY_LIMIT = 200;
const MAX_LOOKUP_LIMIT = 200;
const MAX_PHOTO_FILE_BYTES = 5_242_880;
const SIGNED_PHOTO_TTL_SECONDS = 3600;

const ALLOWED_PHOTO_MIME_TYPES: Readonly<Record<string, 'jpg' | 'png' | 'webp'>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const DATA_URI_IMAGE_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const adminMutationLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: ADMIN_MUTATION_LIMIT,
  windowMs: ADMIN_MUTATION_WINDOW_MS,
  keyPrefix: 'ratelimit:admin-mutation:',
});

const WRITE_ACCESS_LEVELS = new Set(['operate', 'supervise', 'manage']);

const USER_MUTATION_CACHE_TAGS = [
  'table:employees',
  'table:personnel',
  'table:badges',
  'table:operators',
  'table:employee_department_access',
];

/**
 * A role or department change must not wait out the session TTL. Bumping the
 * privilege version fences every cached copy of that employee's session —
 * on every instance — so the next request re-reads the database.
 */
async function revokePrivilegeCache(
  supabase: AdminSupabaseClient,
  employeeId: string | null
): Promise<void> {
  if (!employeeId) return;
  const { data } = await supabase
    .from('employees')
    .select('auth_id')
    .eq('id', employeeId)
    .maybeSingle();
  const authId = (data as { auth_id?: string | null } | null)?.auth_id;
  if (!authId) return;
  await revokeSession(authId, { reason: 'role-change' }).catch(() => undefined);
}

export interface AdminDepartmentOption {
  id: string;
  display_name: string;
}

export interface AdminSiteOption {
  id: string;
  name: string;
  site_code: string;
}

export interface AdminEmployeeRecord {
  id: string;
  auth_id?: string | null;
  email?: string | null;
  record_type?: EmployeeRecordType | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  gender?: EmployeeGender | null;
  date_of_birth?: string | null;
  national_id: string | null;
  job_title: string | null;
  areas: string[] | null;
  medical_expiry_date: string | null;
  induction_expiry_date: string | null;
  employee_code: string | null;
  qr_code_data: string | null;
  photo_url: string | null;
  photo_storage_path?: string | null;
  role: string;
  department_id: string | null;
  accessible_departments: string[] | null;
  department_permissions?: Record<string, DepartmentPermission>;
  created_at: string;
  departments?: {
    display_name: string;
  } | null;
}

export interface UpsertAdminEmployeeInput {
  id?: string | null;
  record_type?: EmployeeRecordType;
  email?: string;
  names: string;
  surname: string;
  full_name: string;
  gender?: EmployeeGender | '' | null;
  birthday?: string;
  id_number: string;
  job_title: string;
  area: string;
  medical_expiry: string;
  induction_expiry: string;
  coy_number: string;
  qr_code: string;
  photo_url: string;
  photo_storage_path?: string | null;
  role: string;
  department_id: string | null;
  accessible_departments: string[];
  department_permissions?: Record<string, DepartmentPermission>;
}

interface RawEmployeeRow {
  id: string;
  auth_id?: string | null;
  record_type?: string | null;
  department_id: string | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  job_title?: string | null;
  areas?: string[] | null;
  medical_expiry_date?: string | null;
  induction_expiry_date?: string | null;
  employee_code?: string | null;
  qr_code_data?: string | null;
  photo_url?: string | null;
  role: string;
  accessible_departments: string[] | null;
  created_at: string;
  departments?:
    | {
        display_name: string;
      }
    | Array<{
        display_name: string;
      }>
    | null;
}

interface RawPersonnelRow {
  id: string;
  emp_code: string;
  first_name: string;
  surname: string;
  gender?: string | null;
  date_of_birth?: string | null;
  record_type?: string | null;
  status?: string | null;
  id_number: string;
  job_title: string | null;
  area?: string | null;
  department_id: string | null;
  medical_expiry: string | null;
  induction_expiry: string | null;
  photo_url: string | null;
  created_at?: string;
  badges?: Array<{ qr_code: string; is_active?: boolean | null }> | { qr_code: string } | null;
}

interface RawDepartmentAccessRow {
  employee_id: string;
  department_id: string;
  access_level: string;
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    Boolean(error.message?.includes('does not exist')) ||
    Boolean(error.message?.includes('schema cache'))
  );
}

function normalizeGender(raw: string | null | undefined): EmployeeGender | null {
  if (raw === 'male' || raw === 'female' || raw === 'other') {
    return raw;
  }
  return null;
}

function normalizeDateOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.split('T')[0] ?? null;
}

function normalizeRecordType(
  raw: string | null | undefined,
  hasPortalAccessFallback: boolean
): EmployeeRecordType {
  if (raw === 'user' || raw === 'employee') {
    return raw;
  }
  return hasPortalAccessFallback ? 'user' : 'employee';
}

function isDirectDisplayUrl(rawUrl: string): boolean {
  return (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('/') ||
    rawUrl.startsWith('blob:')
  );
}

function normalizeDepartmentPermissions(options: {
  readonly accessibleDepartments: readonly string[];
  readonly rawPermissions?: Readonly<Record<string, DepartmentPermission>>;
}): {
  readonly accessibleDepartments: string[];
  readonly departmentPermissions: Record<string, DepartmentPermission>;
} {
  const normalizedMap: Record<string, DepartmentPermission> = {};
  const rawEntries = options.rawPermissions ?? {};

  for (const [deptId, perm] of Object.entries(rawEntries)) {
    if (!deptId) continue;
    const canRead = Boolean(perm.read || perm.write);
    if (!canRead) continue;
    normalizedMap[deptId] = {
      read: true,
      write: Boolean(perm.write),
    };
  }

  for (const deptId of options.accessibleDepartments) {
    if (!deptId) continue;
    if (deptId in rawEntries) {
      const explicitPerm = rawEntries[deptId];
      if (!explicitPerm?.read && !explicitPerm?.write) {
        continue;
      }
    }
    if (!(deptId in normalizedMap)) {
      normalizedMap[deptId] = { read: true, write: true };
    }
  }

  return {
    accessibleDepartments: Object.keys(normalizedMap),
    departmentPermissions: normalizedMap,
  };
}

function buildEmployeePermissions(options: {
  readonly accessibleDepartments: readonly string[] | null;
  readonly accessRows?: Readonly<Record<string, DepartmentPermission>>;
}): {
  readonly accessibleDepartments: string[];
  readonly departmentPermissions: Record<string, DepartmentPermission>;
} {
  const merged: Record<string, DepartmentPermission> = { ...(options.accessRows ?? {}) };
  for (const deptId of options.accessibleDepartments ?? []) {
    if (!deptId) continue;
    if (!(deptId in merged)) {
      merged[deptId] = { read: true, write: true };
    }
  }
  return {
    accessibleDepartments: Object.keys(merged),
    departmentPermissions: merged,
  };
}

function extractBadgeQr(
  badges: Array<{ qr_code: string }> | { qr_code: string } | null | undefined
): string | null {
  if (!badges) return null;
  if (Array.isArray(badges)) {
    return badges[0]?.qr_code ?? null;
  }
  return badges.qr_code ?? null;
}

function normalizeDepartmentJoin(
  departments: { display_name: string } | Array<{ display_name: string }> | null | undefined,
  deptMap: Map<string, string>,
  departmentId: string | null
): { display_name: string } | null {
  if (departments) {
    if (Array.isArray(departments)) {
      return departments[0] ?? null;
    }
    return departments;
  }
  if (departmentId && deptMap.has(departmentId)) {
    return { display_name: deptMap.get(departmentId) ?? '' };
  }
  return null;
}

async function resolveStoredPhotoInput(options: {
  readonly supabase: AdminSupabaseClient;
  readonly rawPhotoUrl: string;
  readonly rawStoragePath?: string | null;
  readonly coyNumber: string;
}): Promise<{ readonly storedPath: string | null; readonly error?: string }> {
  const explicitStoragePath = options.rawStoragePath?.trim();
  if (explicitStoragePath) {
    return { storedPath: explicitStoragePath };
  }

  const trimmedUrl = options.rawPhotoUrl.trim();
  if (!trimmedUrl) {
    return { storedPath: null };
  }

  if (trimmedUrl.startsWith('data:')) {
    const match = DATA_URI_IMAGE_REGEX.exec(trimmedUrl);
    if (!match) {
      return {
        storedPath: null,
        error: 'Unsupported photo format. Upload a PNG, JPEG, or WebP image.',
      };
    }
    const mimeType = match[1] ?? 'image/png';
    const base64Body = match[2] ?? '';
    const ext = ALLOWED_PHOTO_MIME_TYPES[mimeType];
    if (!ext) {
      return {
        storedPath: null,
        error: 'Unsupported photo MIME type. Allowed: JPEG, PNG, WebP.',
      };
    }

    const buffer = Buffer.from(base64Body, 'base64');
    if (buffer.byteLength <= 0 || buffer.byteLength > MAX_PHOTO_FILE_BYTES) {
      return { storedPath: null, error: 'Employee photo must be 5 MB or smaller.' };
    }

    const safePrefix = options.coyNumber.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'staff';
    const objectPath = `${safePrefix}/${Date.now()}.${ext}`;
    const { error: uploadError } = await options.supabase.storage
      .from('personnel-photos')
      .upload(objectPath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return { storedPath: null, error: `Failed to upload employee photo: ${uploadError.message}` };
    }
    return { storedPath: objectPath };
  }

  return { storedPath: trimmedUrl };
}

async function hydrateSignedPhotoUrls(
  supabase: AdminSupabaseClient,
  records: readonly AdminEmployeeRecord[]
): Promise<AdminEmployeeRecord[]> {
  const storageBucket = supabase.storage?.from?.('personnel-photos');
  if (!storageBucket) {
    return [...records];
  }

  const pathsToSign = Array.from(
    new Set(
      records
        .map((rec) => rec.photo_url?.trim() ?? '')
        .filter((val) => Boolean(val) && !isDirectDisplayUrl(val) && !val.startsWith('data:'))
    )
  );

  if (pathsToSign.length === 0) {
    return [...records];
  }

  const signedMap = new Map<string, string>();
  if (typeof storageBucket.createSignedUrls === 'function') {
    const { data } = await storageBucket.createSignedUrls(pathsToSign, SIGNED_PHOTO_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedMap.set(entry.path, entry.signedUrl);
      }
    }
  } else if (typeof storageBucket.createSignedUrl === 'function') {
    await Promise.all(
      pathsToSign.map(async (storagePath) => {
        const { data } = await storageBucket.createSignedUrl(storagePath, SIGNED_PHOTO_TTL_SECONDS);
        if (data?.signedUrl) {
          signedMap.set(storagePath, data.signedUrl);
        }
      })
    );
  }

  return records.map((rec) => {
    const rawPhoto = rec.photo_url?.trim() ?? '';
    if (!rawPhoto || isDirectDisplayUrl(rawPhoto)) {
      return rec;
    }
    return {
      ...rec,
      photo_storage_path: rawPhoto,
      photo_url: signedMap.get(rawPhoto) ?? null,
    };
  });
}

async function syncDepartmentAccessRows(options: {
  readonly supabase: AdminSupabaseClient;
  readonly employeeId: string;
  readonly accessibleDepartments: readonly string[];
  readonly departmentPermissions: Readonly<Record<string, DepartmentPermission>>;
}): Promise<{ readonly error: string | null }> {
  const accessTable = options.supabase.from('employee_department_access');
  if (typeof accessTable?.select !== 'function') {
    return { error: null };
  }

  const { data: existingRows, error: selectErr } = await accessTable
    .select('department_id')
    .eq('employee_id', options.employeeId);

  if (selectErr) {
    return { error: `Failed to read department permissions: ${selectErr.message}` };
  }

  const activeDeptSet = new Set(options.accessibleDepartments);
  const removedDeptIds = ((existingRows ?? []) as Array<{ department_id: string }>)
    .map((row) => row.department_id)
    .filter((deptId) => !activeDeptSet.has(deptId));

  if (removedDeptIds.length > 0 && typeof accessTable.delete === 'function') {
    const { error: deleteErr } = await accessTable
      .delete()
      .eq('employee_id', options.employeeId)
      .in('department_id', removedDeptIds);
    if (deleteErr) {
      return { error: `Failed to revoke removed department permissions: ${deleteErr.message}` };
    }
  }

  if (options.accessibleDepartments.length > 0 && typeof accessTable.upsert === 'function') {
    const rows = options.accessibleDepartments.map((departmentId) => ({
      employee_id: options.employeeId,
      department_id: departmentId,
      access_level: options.departmentPermissions[departmentId]?.write
        ? ('operate' as const)
        : ('read' as const),
      updated_at: new Date().toISOString(),
    }));
    const { error: upsertErr } = await accessTable.upsert(rows, {
      onConflict: 'employee_id,department_id',
    });
    if (upsertErr) {
      return { error: `Failed to save department permissions: ${upsertErr.message}` };
    }
  }

  return { error: null };
}

function buildDepartmentSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchCallerEmployee(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  selectColumns: 'role' | 'id, role' = 'role'
): Promise<{ id?: string; role?: string } | null> {
  let query = supabase.from('employees').select(selectColumns).eq('auth_id', userId);
  if (typeof (query as unknown as { is?: unknown }).is === 'function') {
    query = (query as unknown as { is: (col: string, val: null) => typeof query }).is(
      'deleted_at',
      null
    );
  }
  const { data } = await query.single();
  return (data as { id?: string; role?: string } | null) ?? null;
}

export async function createDepartment(payload: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createDepartment' },
    });
  }

  const callerEmployee = await fetchCallerEmployee(supabase, user.id, 'role');

  if (callerEmployee?.role !== 'admin') {
    throw new AuthError('Forbidden: admin role required', {
      context: { action: 'createDepartment', userId: user.id },
    });
  }

  const parsed = adminAddDepartmentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid department payload', {
      context: { action: 'createDepartment' },
    });
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    throw new RateLimitError('Rate limit exceeded', { context: { action: 'createDepartment' } });
  }

  const displayName = parsed.data.display_name.trim();
  const slug = parsed.data.name
    ? buildDepartmentSlug(parsed.data.name)
    : buildDepartmentSlug(displayName);
  if (!slug) {
    throw new ValidationError('Department name must contain alphanumeric characters', {
      context: { action: 'createDepartment' },
    });
  }

  const { error } = await supabase.from('departments').insert({
    name: slug,
    display_name: displayName,
    color:
      typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : 'slate',
    icon:
      typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : 'Building2',
  });

  if (error) {
    throw new DatabaseError('Failed to create department', {
      operation: 'insert',
      table: 'departments',
      context: { error: error.message },
    });
  }

  logAdminAuditEvent({
    actorId: user.id,
    action: 'create',
    resource: 'departments',
    metadata: { name: slug, display_name: displayName },
  });

  await updateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true };
}

/**
 * Upload an employee profile photo to Supabase Storage (`personnel-photos` bucket)
 * rather than persisting base64 data URIs in PostgreSQL text columns.
 */
export async function uploadEmployeePhoto(formData: FormData): Promise<{
  success: boolean;
  storagePath?: string;
  previewUrl?: string;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const callerEmployee = await fetchCallerEmployee(supabase, user.id, 'role');

  if (callerEmployee?.role !== 'admin') {
    return { success: false, error: 'Forbidden: admin role required' };
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  const rawFile = formData.get('photo');
  if (!rawFile || typeof rawFile !== 'object' || !('type' in rawFile) || !('size' in rawFile)) {
    return { success: false, error: 'Photo image file is required' };
  }

  const file = rawFile as File;
  const ext = ALLOWED_PHOTO_MIME_TYPES[file.type];
  if (!ext) {
    return { success: false, error: 'Unsupported photo format. Allowed: JPEG, PNG, or WebP' };
  }
  if (file.size <= 0 || file.size > MAX_PHOTO_FILE_BYTES) {
    return { success: false, error: 'Photo size must be between 1 byte and 5 MB' };
  }

  const rawCoy =
    typeof formData.get('coy_number') === 'string' ? (formData.get('coy_number') as string) : '';
  const safePrefix =
    rawCoy
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase() || 'employee';
  const storagePath = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('personnel-photos')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: `Failed to upload photo: ${uploadError.message}` };
  }

  let previewUrl = storagePath;
  const bucket = supabase.storage.from('personnel-photos');
  if (typeof bucket.createSignedUrl === 'function') {
    const { data: signed } = await bucket.createSignedUrl(storagePath, SIGNED_PHOTO_TTL_SECONDS);
    if (signed?.signedUrl) {
      previewUrl = signed.signedUrl;
    }
  }

  logAdminAuditEvent({
    actorId: user.id,
    action: 'upload_photo',
    resource: 'personnel-photos',
    resourceId: storagePath,
    metadata: { mimeType: file.type, sizeBytes: file.size },
  });

  return { success: true, storagePath, previewUrl };
}

/**
 * Load employees, departments, sites, department permissions, and linked personnel/badges on the server
 * so HttpOnly Supabase auth cookies are forwarded and RLS evaluates as the signed-in admin.
 */
export async function getUsersAdminData(rawQuery?: {
  readonly limit?: number;
  readonly offset?: number;
}): Promise<{
  employees: AdminEmployeeRecord[];
  departments: AdminDepartmentOption[];
  sites: AdminSiteOption[];
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', {
      context: { action: 'getUsersAdminData' },
    });
  }

  const callerEmployee = await fetchCallerEmployee(supabase, user.id, 'role');

  if (callerEmployee?.role !== 'admin') {
    throw new AuthError('Forbidden: admin role required', {
      context: { action: 'getUsersAdminData', userId: user.id },
    });
  }

  const parsedPagination = adminDataQuerySchema.safeParse({
    limit: rawQuery?.limit ?? DEFAULT_USERS_QUERY_LIMIT,
    offset: rawQuery?.offset ?? 0,
  });
  const pageLimit = parsedPagination.success
    ? parsedPagination.data.limit
    : DEFAULT_USERS_QUERY_LIMIT;
  const pageOffset = parsedPagination.success ? parsedPagination.data.offset : 0;

  const buildEmployeesQuery = () => {
    let query = supabase.from('employees').select('*, departments(display_name)');
    if (typeof query.is === 'function') {
      query = query.is('deleted_at', null);
    }
    query = query.order('created_at', { ascending: false });
    if (typeof query.range === 'function') {
      query = query.range(pageOffset, pageOffset + pageLimit - 1);
    } else if (typeof query.limit === 'function') {
      query = query.limit(pageLimit);
    }
    return query;
  };

  const buildDepartmentsQuery = () => {
    let query = supabase.from('departments').select('id, display_name');
    if (typeof query.is === 'function') {
      query = query.is('deleted_at', null);
    }
    if (typeof query.order === 'function') {
      query = query.order('display_name', { ascending: true });
    }
    if (typeof query.limit === 'function') {
      query = query.limit(MAX_LOOKUP_LIMIT);
    }
    return query;
  };

  const buildPersonnelQuery = () => {
    let query = supabase.from('personnel').select('*, badges(qr_code, is_active)');
    if (typeof query.neq === 'function') {
      query = query.neq('status', 'Inactive');
    }
    if (typeof query.limit === 'function') {
      query = query.limit(pageLimit);
    }
    return query;
  };

  const buildSitesQuery = () => {
    const sitesTable = supabase.from('sites');
    if (typeof sitesTable?.select !== 'function') {
      return Promise.resolve({ data: [] as AdminSiteOption[], error: null });
    }
    let query = sitesTable.select('id, name, site_code');
    if (typeof query.is === 'function') {
      query = query.is('deleted_at', null);
    }
    if (typeof query.eq === 'function') {
      query = query.eq('active', true);
    }
    if (typeof query.order === 'function') {
      query = query.order('name', { ascending: true });
    }
    if (typeof query.limit === 'function') {
      query = query.limit(MAX_LOOKUP_LIMIT);
    }
    return query;
  };

  const accessTable = supabase.from('employee_department_access');
  const accessPromise =
    typeof accessTable?.select === 'function'
      ? (() => {
          const query = accessTable.select('employee_id, department_id, access_level');
          return typeof query?.limit === 'function' ? query.limit(1000) : query;
        })()
      : Promise.resolve({ data: null, error: null });

  const [empResult, deptResult, persResult, accessResult, sitesResult] = await Promise.all([
    buildEmployeesQuery(),
    buildDepartmentsQuery(),
    buildPersonnelQuery(),
    accessPromise,
    buildSitesQuery(),
  ]);

  if (empResult.error) {
    throw new DatabaseError('Failed to load employees', {
      operation: 'select',
      table: 'employees',
      context: { error: empResult.error.message },
    });
  }

  if (deptResult.error) {
    throw new DatabaseError('Failed to load departments', {
      operation: 'select',
      table: 'departments',
      context: { error: deptResult.error.message },
    });
  }

  if (persResult.error) {
    throw new DatabaseError('Failed to load personnel records', {
      operation: 'select',
      table: 'personnel',
      context: { error: persResult.error.message },
    });
  }

  if (accessResult.error) {
    throw new DatabaseError('Failed to load employee department permissions', {
      operation: 'select',
      table: 'employee_department_access',
      context: { error: accessResult.error.message },
    });
  }

  if (sitesResult.error) {
    throw new DatabaseError('Failed to load sites', {
      operation: 'select',
      table: 'sites',
      context: { error: sitesResult.error.message },
    });
  }

  const departments = (deptResult.data ?? []) as AdminDepartmentOption[];
  const sites = (sitesResult.data ?? []) as AdminSiteOption[];
  const deptMap = new Map<string, string>(departments.map((d) => [d.id, d.display_name]));

  const accessByEmployee = new Map<string, Record<string, DepartmentPermission>>();
  if (Array.isArray(accessResult.data)) {
    for (const row of accessResult.data as RawDepartmentAccessRow[]) {
      const existing = accessByEmployee.get(row.employee_id) ?? {};
      existing[row.department_id] = {
        read: true,
        write: WRITE_ACCESS_LEVELS.has(row.access_level),
      };
      accessByEmployee.set(row.employee_id, existing);
    }
  }

  const persRows = ((persResult.data ?? []) as RawPersonnelRow[]).filter(
    (person) => person.status?.toLowerCase() !== 'inactive'
  );
  const persByCode = new Map<string, RawPersonnelRow>();
  const persByName = new Map<string, RawPersonnelRow>();

  for (const person of persRows) {
    if (person.emp_code) {
      persByCode.set(person.emp_code.trim().toUpperCase(), person);
    }
    const fullNameKey = `${person.first_name ?? ''} ${person.surname ?? ''}`.trim().toLowerCase();
    if (fullNameKey) {
      persByName.set(fullNameKey, person);
    }
  }

  const matchedPersonnelCodes = new Set<string>();
  const empRows = (empResult.data ?? []) as RawEmployeeRow[];

  const enrichedEmployees: AdminEmployeeRecord[] = empRows.map((emp) => {
    const codeKey = emp.employee_code?.trim().toUpperCase() ?? '';
    const nameKey = emp.full_name.trim().toLowerCase();
    const linked = (codeKey ? persByCode.get(codeKey) : undefined) ?? persByName.get(nameKey);

    if (linked?.emp_code) {
      matchedPersonnelCodes.add(linked.emp_code.trim().toUpperCase());
    }
    if (codeKey) {
      matchedPersonnelCodes.add(codeKey);
    }

    const nameParts = emp.full_name.trim().split(/\s+/);
    const derivedFirstName = nameParts[0] || null;
    const derivedLastName = nameParts.slice(1).join(' ') || null;
    const resolvedDepartmentId = emp.department_id ?? linked?.department_id ?? null;

    const { accessibleDepartments, departmentPermissions } = buildEmployeePermissions({
      accessibleDepartments: emp.accessible_departments,
      accessRows: accessByEmployee.get(emp.id),
    });

    const resolvedGender = normalizeGender(emp.gender ?? linked?.gender);
    const resolvedBirthday = normalizeDateOnly(emp.date_of_birth ?? linked?.date_of_birth);
    const resolvedRecordType = normalizeRecordType(
      emp.record_type ?? linked?.record_type,
      Boolean(emp.auth_id || accessibleDepartments.length > 0)
    );

    return {
      id: emp.id,
      auth_id: emp.auth_id ?? null,
      record_type: resolvedRecordType,
      full_name: emp.full_name,
      first_name: emp.first_name ?? linked?.first_name ?? derivedFirstName,
      last_name: emp.last_name ?? linked?.surname ?? derivedLastName,
      gender: resolvedGender,
      date_of_birth: resolvedBirthday,
      national_id: emp.national_id ?? linked?.id_number ?? null,
      job_title: emp.job_title ?? linked?.job_title ?? null,
      areas: emp.areas && emp.areas.length > 0 ? emp.areas : linked?.area ? [linked.area] : null,
      medical_expiry_date: emp.medical_expiry_date ?? linked?.medical_expiry ?? null,
      induction_expiry_date: emp.induction_expiry_date ?? linked?.induction_expiry ?? null,
      employee_code: emp.employee_code ?? linked?.emp_code ?? null,
      qr_code_data: emp.qr_code_data ?? extractBadgeQr(linked?.badges) ?? null,
      photo_url: emp.photo_url ?? linked?.photo_url ?? null,
      role: emp.role,
      department_id: resolvedDepartmentId,
      accessible_departments: accessibleDepartments,
      department_permissions: departmentPermissions,
      created_at: emp.created_at,
      departments: normalizeDepartmentJoin(emp.departments, deptMap, resolvedDepartmentId),
    };
  });

  // Include any provisioned personnel rows that do not yet have a linked employees row
  for (const person of persRows) {
    const codeKey = person.emp_code?.trim().toUpperCase() ?? '';
    if (codeKey && matchedPersonnelCodes.has(codeKey)) {
      continue;
    }
    const fullName = `${person.first_name ?? ''} ${person.surname ?? ''}`.trim() || person.emp_code;
    const resolvedDeptId = person.department_id ?? null;
    const { accessibleDepartments, departmentPermissions } = buildEmployeePermissions({
      accessibleDepartments: resolvedDeptId ? [resolvedDeptId] : [],
    });

    enrichedEmployees.push({
      id: person.id,
      auth_id: null,
      record_type: normalizeRecordType(person.record_type, false),
      full_name: fullName,
      first_name: person.first_name ?? null,
      last_name: person.surname ?? null,
      gender: normalizeGender(person.gender),
      date_of_birth: normalizeDateOnly(person.date_of_birth),
      national_id: person.id_number ?? null,
      job_title: person.job_title ?? null,
      areas: person.area ? [person.area] : null,
      medical_expiry_date: person.medical_expiry ?? null,
      induction_expiry_date: person.induction_expiry ?? null,
      employee_code: person.emp_code,
      qr_code_data: extractBadgeQr(person.badges),
      photo_url: person.photo_url ?? null,
      role: 'operator',
      department_id: resolvedDeptId,
      accessible_departments: accessibleDepartments,
      department_permissions: departmentPermissions,
      created_at: person.created_at ?? new Date().toISOString(),
      departments: normalizeDepartmentJoin(null, deptMap, resolvedDeptId),
    });
  }

  const hydratedEmployees = await hydrateSignedPhotoUrls(supabase, enrichedEmployees);

  return {
    employees: hydratedEmployees,
    departments,
    sites,
  };
}

/**
 * Create or update an employee/user across `employees`, `personnel`, `badges`,
 * and `employee_department_access`.
 * - Portal login accounts (`record_type === 'user'`) receive their own `auth.users` UUID via
 *   `createServiceRoleClient().auth.admin.inviteUserByEmail(...)`.
 * - Badge/HR-only staff (`record_type === 'employee'`) persist to `personnel` + `badges`
 *   without hijacking the calling admin's `auth_id`.
 */
export async function upsertEmployeeAdmin(
  formData: UpsertAdminEmployeeInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const callerEmployee = await fetchCallerEmployee(supabase, user.id, 'role');

  if (callerEmployee?.role !== 'admin') {
    return { success: false, error: 'Forbidden: admin role required' };
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  const parsed = upsertAdminEmployeeSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid employee details',
    };
  }

  const validated = parsed.data;
  const { accessibleDepartments, departmentPermissions } = normalizeDepartmentPermissions({
    accessibleDepartments: validated.accessible_departments,
    rawPermissions: validated.department_permissions,
  });
  const resolvedGender = normalizeGender(validated.gender);
  const resolvedBirthday = normalizeDateOnly(validated.birthday);
  const resolvedRecordType = validated.record_type;

  const resolvedFullName =
    validated.full_name.trim() || `${validated.names.trim()} ${validated.surname.trim()}`.trim();

  const namePrefix = (validated.names.trim() || resolvedFullName || 'EMP')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const deterministicSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const resolvedCoyNumber =
    validated.coy_number.trim() || `EMP-${namePrefix || 'STAFF'}-${deterministicSuffix}`;

  const photoResolution = await resolveStoredPhotoInput({
    supabase,
    rawPhotoUrl: validated.photo_url,
    rawStoragePath: validated.photo_storage_path,
    coyNumber: resolvedCoyNumber,
  });
  if (photoResolution.error) {
    return { success: false, error: photoResolution.error };
  }
  const storedPhotoPath = photoResolution.storedPath;

  const extendedEmployeeColumns = {
    full_name: resolvedFullName,
    first_name: validated.names.trim() || null,
    last_name: validated.surname.trim() || null,
    gender: resolvedGender,
    date_of_birth: resolvedBirthday,
    record_type: resolvedRecordType,
    national_id: validated.id_number.trim() || null,
    job_title: validated.job_title.trim() || null,
    areas: validated.area.trim() ? [validated.area.trim()] : [],
    medical_expiry_date: validated.medical_expiry || null,
    induction_expiry_date: validated.induction_expiry || null,
    employee_code: resolvedCoyNumber,
    qr_code_data: validated.qr_code.trim() || null,
    photo_url: storedPhotoPath,
    role: validated.role,
    department_id: validated.department_id,
    accessible_departments: accessibleDepartments,
  };

  const coreEmployeeColumns = {
    full_name: resolvedFullName,
    employee_code: resolvedCoyNumber,
    role: validated.role,
    department_id: validated.department_id,
    accessible_departments: accessibleDepartments,
  };

  let targetEmployeeId: string | null = null;
  if (validated.id) {
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', validated.id)
      .maybeSingle();
    if (existingEmp?.id) {
      targetEmployeeId = existingEmp.id;
    }
  }

  if (!targetEmployeeId && resolvedCoyNumber) {
    const { data: byCode } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', resolvedCoyNumber)
      .maybeSingle();
    if (byCode?.id) {
      targetEmployeeId = byCode.id;
    }
  }

  if (targetEmployeeId) {
    let { error: empError } = await supabase
      .from('employees')
      .update(extendedEmployeeColumns)
      .eq('id', targetEmployeeId);

    if (empError && isMissingColumnError(empError)) {
      const fallback = await supabase
        .from('employees')
        .update(coreEmployeeColumns)
        .eq('id', targetEmployeeId);
      empError = fallback.error;
    }

    if (empError) {
      return { success: false, error: empError.message };
    }
  } else if (resolvedRecordType === 'user') {
    const normalizedEmail = validated.email?.trim().toLowerCase() ?? '';
    if (!normalizedEmail) {
      return {
        success: false,
        error: 'Email address is required to create a portal login user',
      };
    }

    let invitedAuthUserId: string | null = null;
    try {
      const serviceClient = createServiceRoleClient();
      const { data: inviteData, error: inviteError } =
        await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: {
            full_name: resolvedFullName,
            employee_code: resolvedCoyNumber,
            role: validated.role,
          },
        });

      if (inviteError || !inviteData?.user?.id) {
        return {
          success: false,
          error: inviteError?.message ?? 'Failed to invite portal user by email',
        };
      }
      invitedAuthUserId = inviteData.user.id;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to provision auth user account',
      };
    }

    let { error: empInsertError } = await supabase.from('employees').insert({
      ...extendedEmployeeColumns,
      auth_id: invitedAuthUserId,
    });

    if (empInsertError && isMissingColumnError(empInsertError)) {
      const fallback = await supabase.from('employees').insert({
        ...coreEmployeeColumns,
        auth_id: invitedAuthUserId,
      });
      empInsertError = fallback.error;
    }

    if (empInsertError) {
      return { success: false, error: empInsertError.message };
    }

    const { data: createdEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_id', invitedAuthUserId)
      .maybeSingle();
    if (createdEmp?.id) {
      targetEmployeeId = createdEmp.id;
    }
  }

  if (targetEmployeeId) {
    const accessSync = await syncDepartmentAccessRows({
      supabase,
      employeeId: targetEmployeeId,
      accessibleDepartments,
      departmentPermissions,
    });
    if (accessSync.error) {
      return { success: false, error: accessSync.error };
    }
  }

  // Synchronize with `personnel` + `badges`
  const firstName = validated.names.trim() || resolvedFullName.split(/\s+/)[0] || 'Employee';
  const surname =
    validated.surname.trim() || resolvedFullName.split(/\s+/).slice(1).join(' ') || 'Record';
  const idNumber = validated.id_number.trim() || resolvedCoyNumber;
  const qrCode = validated.qr_code.trim() || `QR-${resolvedCoyNumber}`;

  let personnelId: string | null = null;
  if (validated.id) {
    const { data: byPersId } = await supabase
      .from('personnel')
      .select('id')
      .eq('id', validated.id)
      .maybeSingle();
    if (byPersId?.id) {
      personnelId = byPersId.id;
    }
  }

  if (!personnelId) {
    const { data: existingPers } = await supabase
      .from('personnel')
      .select('id')
      .eq('emp_code', resolvedCoyNumber)
      .maybeSingle();
    personnelId = existingPers?.id ?? null;
  }

  const basePersonnelFields = {
    emp_code: resolvedCoyNumber,
    first_name: firstName,
    surname,
    id_number: idNumber,
    job_title: validated.job_title.trim() || null,
    department_id: validated.department_id,
    medical_expiry: validated.medical_expiry || null,
    induction_expiry: validated.induction_expiry || null,
    photo_url: storedPhotoPath,
  };

  if (personnelId) {
    const updateWithExtended = {
      ...basePersonnelFields,
      area: validated.area.trim() || null,
      gender: resolvedGender,
      date_of_birth: resolvedBirthday,
      record_type: resolvedRecordType,
      status: 'Active',
      updated_at: new Date().toISOString(),
    };
    let { error: persUpdateErr } = await supabase
      .from('personnel')
      .update(updateWithExtended)
      .eq('id', personnelId);

    if (persUpdateErr && isMissingColumnError(persUpdateErr)) {
      const { error: retryErr } = await supabase
        .from('personnel')
        .update({
          ...basePersonnelFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', personnelId);
      persUpdateErr = retryErr;
    }

    if (persUpdateErr) {
      return { success: false, error: persUpdateErr.message };
    }
  } else {
    const insertWithExtended = {
      ...basePersonnelFields,
      area: validated.area.trim() || null,
      gender: resolvedGender,
      date_of_birth: resolvedBirthday,
      record_type: resolvedRecordType,
      status: 'Active',
    };
    let { data: insertedPers, error: persInsertErr } = await supabase
      .from('personnel')
      .insert(insertWithExtended)
      .select('id')
      .maybeSingle();

    if (persInsertErr && isMissingColumnError(persInsertErr)) {
      const retry = await supabase
        .from('personnel')
        .insert({
          ...basePersonnelFields,
          status: 'Active',
        })
        .select('id')
        .maybeSingle();
      insertedPers = retry.data;
      persInsertErr = retry.error;
    }

    if (persInsertErr) {
      return { success: false, error: persInsertErr.message };
    }

    personnelId = insertedPers?.id ?? null;
  }

  if (personnelId && qrCode) {
    const { data: existingBadge } = await supabase
      .from('badges')
      .select('id')
      .eq('personnel_id', personnelId)
      .maybeSingle();

    if (existingBadge?.id) {
      const { error: badgeUpdateErr } = await supabase
        .from('badges')
        .update({
          qr_code: qrCode,
          department_id: validated.department_id,
          is_active: true,
          revoked_at: null,
          expires_at: validated.induction_expiry || validated.medical_expiry || null,
        })
        .eq('id', existingBadge.id);
      if (badgeUpdateErr) {
        return { success: false, error: `Failed to update badge: ${badgeUpdateErr.message}` };
      }
    } else {
      const { error: badgeInsertErr } = await supabase.from('badges').insert({
        qr_code: qrCode,
        entity_type: 'personnel',
        personnel_id: personnelId,
        department_id: validated.department_id,
        is_active: true,
        issued_at: new Date().toISOString(),
        expires_at: validated.induction_expiry || validated.medical_expiry || null,
      });
      if (badgeInsertErr) {
        return { success: false, error: `Failed to issue badge: ${badgeInsertErr.message}` };
      }
    }
  }

  // Synchronize with `operators` so employee is selectable across Control Room, Drilling, Production
  if (resolvedCoyNumber && resolvedFullName) {
    const operatorRole =
      validated.role === 'admin' || validated.role === 'supervisor' || validated.role === 'manager'
        ? 'supervisor'
        : 'operator';
    const opTable = supabase.from('operators');
    if (typeof opTable?.select === 'function') {
      const { data: existingOp, error: opLookupErr } = await opTable
        .select('id')
        .eq('employee_code', resolvedCoyNumber)
        .maybeSingle();

      if (opLookupErr) {
        return {
          success: false,
          error: `Failed to inspect operator record: ${opLookupErr.message}`,
        };
      }

      if (existingOp?.id) {
        const { error: opUpdateErr } = await supabase
          .from('operators')
          .update({
            full_name: resolvedFullName,
            role: operatorRole,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOp.id);
        if (opUpdateErr) {
          return {
            success: false,
            error: `Failed to update operator record: ${opUpdateErr.message}`,
          };
        }
      } else {
        const { error: opInsertErr } = await supabase.from('operators').insert({
          full_name: resolvedFullName,
          employee_code: resolvedCoyNumber,
          role: operatorRole,
          active: true,
        });
        if (opInsertErr) {
          return {
            success: false,
            error: `Failed to create operator record: ${opInsertErr.message}`,
          };
        }
      }
    }
  }

  logAdminAuditEvent({
    actorId: user.id,
    action: validated.id ? 'update' : 'create',
    resource: resolvedRecordType === 'user' ? 'employees' : 'personnel',
    resourceId: targetEmployeeId ?? personnelId,
    metadata: {
      employee_code: resolvedCoyNumber,
      record_type: resolvedRecordType,
      role: validated.role,
    },
  });

  await revokePrivilegeCache(supabase, targetEmployeeId);

  await updateTags(USER_MUTATION_CACHE_TAGS);
  revalidatePath('/admin');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room/shift-compilation');
  return { success: true };
}

/**
 * Soft-deletes an employee/user record, marks linked personnel Inactive,
 * revokes active access badges, logs an admin audit event, and invalidates caches.
 */
export async function deactivateEmployeeAdmin(
  rawId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const callerEmployee = await fetchCallerEmployee(supabase, user.id, 'id, role');

  if (callerEmployee?.role !== 'admin') {
    return { success: false, error: 'Forbidden: admin role required' };
  }

  const parsed = adminDeleteEmployeeSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Employee ID is required' };
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  const targetId = parsed.data.id;
  const nowIso = new Date().toISOString();

  const { data: existingEmp, error: empLookupErr } = await supabase
    .from('employees')
    .select('id, auth_id, employee_code, full_name')
    .eq('id', targetId)
    .maybeSingle();

  if (empLookupErr) {
    return { success: false, error: empLookupErr.message };
  }

  if (existingEmp?.auth_id === user.id) {
    return { success: false, error: 'You cannot deactivate your own active admin account' };
  }

  let resolvedEmpCode = existingEmp?.employee_code ?? null;
  let personnelId: string | null = null;

  if (existingEmp?.id) {
    const { error: softDeleteErr } = await supabase
      .from('employees')
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq('id', existingEmp.id);

    if (softDeleteErr) {
      return { success: false, error: softDeleteErr.message };
    }

    if (existingEmp.auth_id) {
      try {
        const serviceClient = createServiceRoleClient();
        if (typeof serviceClient.auth?.admin?.updateUserById === 'function') {
          await serviceClient.auth.admin.updateUserById(existingEmp.auth_id, {
            ban_duration: '876000h',
          });
        }
      } catch (banErr) {
        logger.warn({
          event: 'deactivate_employee_auth_ban_failed',
          employeeId: existingEmp.id,
          error: banErr instanceof Error ? banErr.message : String(banErr),
        });
      }
    }
  }

  const { data: persById } = await supabase
    .from('personnel')
    .select('id, emp_code')
    .eq('id', targetId)
    .maybeSingle();

  if (persById?.id) {
    personnelId = persById.id;
    resolvedEmpCode = resolvedEmpCode ?? persById.emp_code;
  } else if (resolvedEmpCode) {
    const { data: persByCode } = await supabase
      .from('personnel')
      .select('id, emp_code')
      .eq('emp_code', resolvedEmpCode)
      .maybeSingle();
    if (persByCode?.id) {
      personnelId = persByCode.id;
    }
  }

  if (!existingEmp?.id && !personnelId) {
    return { success: false, error: 'Employee or personnel record not found' };
  }

  if (personnelId) {
    const { error: persDeactivateErr } = await supabase
      .from('personnel')
      .update({ status: 'Inactive', updated_at: nowIso })
      .eq('id', personnelId);

    if (persDeactivateErr) {
      return { success: false, error: persDeactivateErr.message };
    }

    const badgesTable = supabase.from('badges');
    if (typeof badgesTable?.update === 'function') {
      const { error: badgeErr } = await badgesTable
        .update({ is_active: false, revoked_at: nowIso })
        .eq('personnel_id', personnelId);
      if (badgeErr) {
        return { success: false, error: `Failed to revoke badges: ${badgeErr.message}` };
      }
    }
  }

  if (resolvedEmpCode) {
    const opTable = supabase.from('operators');
    if (typeof opTable?.update === 'function') {
      await opTable
        .update({ active: false, updated_at: nowIso })
        .eq('employee_code', resolvedEmpCode);
    }
  }

  await revokePrivilegeCache(supabase, existingEmp?.id ?? null);

  logAdminAuditEvent({
    actorId: user.id,
    action: 'deactivate',
    resource: existingEmp?.id ? 'employees' : 'personnel',
    resourceId: targetId,
    metadata: { employee_code: resolvedEmpCode },
  });

  await updateTags(USER_MUTATION_CACHE_TAGS);
  revalidatePath('/admin');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room/shift-compilation');
  return { success: true };
}
