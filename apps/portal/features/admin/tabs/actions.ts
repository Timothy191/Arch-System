'use server';

import {
  type DepartmentPermission,
  type EmployeeGender,
  type EmployeeRecordType,
  upsertAdminEmployeeSchema,
} from '@repo/contract';
import { AuthError, DatabaseError, RateLimitError } from '@repo/errors';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { cacheInvalidateTags, revokeSession } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

type AdminSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const adminMutationLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: 30,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:admin-mutation:',
});

const WRITE_ACCESS_LEVELS = new Set(['operate', 'supervise', 'manage']);

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

export interface AdminEmployeeRecord {
  id: string;
  auth_id?: string | null;
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
  id_number: string;
  job_title: string | null;
  area?: string | null;
  department_id: string | null;
  medical_expiry: string | null;
  induction_expiry: string | null;
  photo_url: string | null;
  created_at?: string;
  badges?: Array<{ qr_code: string }> | { qr_code: string } | null;
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

async function syncDepartmentAccessRows(options: {
  readonly supabase: AdminSupabaseClient;
  readonly employeeId: string;
  readonly accessibleDepartments: readonly string[];
  readonly departmentPermissions: Readonly<Record<string, DepartmentPermission>>;
}): Promise<void> {
  try {
    const accessTable = options.supabase.from('employee_department_access');
    if (typeof accessTable?.select !== 'function') {
      return;
    }

    const { data: existingRows, error: selectErr } = await accessTable
      .select('department_id')
      .eq('employee_id', options.employeeId);

    if (selectErr) {
      return;
    }

    const activeDeptSet = new Set(options.accessibleDepartments);
    const removedDeptIds = ((existingRows ?? []) as Array<{ department_id: string }>)
      .map((row) => row.department_id)
      .filter((deptId) => !activeDeptSet.has(deptId));

    if (removedDeptIds.length > 0 && typeof accessTable.delete === 'function') {
      await accessTable
        .delete()
        .eq('employee_id', options.employeeId)
        .in('department_id', removedDeptIds);
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
      await accessTable.upsert(rows, { onConflict: 'employee_id,department_id' });
    }
  } catch {
    // Gracefully skip junction sync if table or mock does not expose junction methods
  }
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

  const { data: callerEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (callerEmployee?.role !== 'admin') {
    throw new AuthError('Forbidden: admin role required', {
      context: { action: 'createDepartment', userId: user.id },
    });
  }

  const rateLimit = await adminMutationLimiter.check(user.id);
  if (!rateLimit.allowed) {
    throw new RateLimitError('Rate limit exceeded', { context: { action: 'createDepartment' } });
  }

  const { error } = await supabase.from('departments').insert(payload);

  if (error) {
    throw new DatabaseError('Failed to create department', {
      operation: 'insert',
      table: 'departments',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:departments']);
  revalidatePath('/admin');
  return { success: true };
}

/**
 * Load employees, departments, department permissions, and linked personnel/badges on the server
 * so HttpOnly Supabase auth cookies are forwarded and RLS evaluates as the signed-in admin.
 */
export async function getUsersAdminData(): Promise<{
  employees: AdminEmployeeRecord[];
  departments: AdminDepartmentOption[];
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

  const { data: callerEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (callerEmployee?.role !== 'admin') {
    throw new AuthError('Forbidden: admin role required', {
      context: { action: 'getUsersAdminData', userId: user.id },
    });
  }

  const accessTable = supabase.from('employee_department_access');
  const accessPromise =
    typeof accessTable?.select === 'function'
      ? accessTable.select('employee_id, department_id, access_level')
      : Promise.resolve({ data: null, error: null });

  const [empResult, deptResult, persResult, accessResult] = await Promise.all([
    supabase
      .from('employees')
      .select('*, departments(display_name)')
      .order('created_at', { ascending: false }),
    supabase.from('departments').select('id, display_name'),
    supabase.from('personnel').select('*, badges(qr_code)'),
    accessPromise,
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

  const departments = (deptResult.data ?? []) as AdminDepartmentOption[];
  const deptMap = new Map<string, string>(departments.map((d) => [d.id, d.display_name]));

  const accessByEmployee = new Map<string, Record<string, DepartmentPermission>>();
  if (!accessResult.error && Array.isArray(accessResult.data)) {
    for (const row of accessResult.data as RawDepartmentAccessRow[]) {
      const existing = accessByEmployee.get(row.employee_id) ?? {};
      existing[row.department_id] = {
        read: true,
        write: WRITE_ACCESS_LEVELS.has(row.access_level),
      };
      accessByEmployee.set(row.employee_id, existing);
    }
  }

  const persRows = (persResult.data ?? []) as RawPersonnelRow[];
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

  return {
    employees: enrichedEmployees,
    departments,
  };
}

/**
 * Create or update an employee/user across `employees`, `personnel`, `badges`,
 * and `employee_department_access`.
 * Gracefully handles cloud schema drift when optional migrations are not yet applied.
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

  const { data: callerEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

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
    photo_url: validated.photo_url || null,
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
  } else if (!validated.id) {
    let { error: empInsertError } = await supabase.from('employees').insert({
      ...extendedEmployeeColumns,
      auth_id: user.id,
    });

    if (empInsertError && isMissingColumnError(empInsertError)) {
      const fallback = await supabase.from('employees').insert({
        ...coreEmployeeColumns,
        auth_id: user.id,
      });
      empInsertError = fallback.error;
    }

    // If auth_id uniqueness or FK constraint blocks inserting a second row for the admin's auth_id,
    // we still proceed to provision the personnel + badge record so non-login staff are persisted.
    if (
      empInsertError &&
      empInsertError.code !== '23505' &&
      !empInsertError.message.includes('duplicate key')
    ) {
      return { success: false, error: empInsertError.message };
    }

    if (!empInsertError && resolvedCoyNumber) {
      const { data: createdEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_code', resolvedCoyNumber)
        .maybeSingle();
      if (createdEmp?.id) {
        targetEmployeeId = createdEmp.id;
      }
    }
  }

  if (targetEmployeeId) {
    await syncDepartmentAccessRows({
      supabase,
      employeeId: targetEmployeeId,
      accessibleDepartments,
      departmentPermissions,
    });
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
    photo_url: validated.photo_url || null,
  };

  if (personnelId) {
    const updateWithExtended = {
      ...basePersonnelFields,
      area: validated.area.trim() || null,
      gender: resolvedGender,
      date_of_birth: resolvedBirthday,
      record_type: resolvedRecordType,
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
      await supabase
        .from('badges')
        .update({
          qr_code: qrCode,
          department_id: validated.department_id,
          expires_at: validated.induction_expiry || validated.medical_expiry || null,
        })
        .eq('id', existingBadge.id);
    } else {
      await supabase.from('badges').insert({
        qr_code: qrCode,
        entity_type: 'personnel',
        personnel_id: personnelId,
        department_id: validated.department_id,
        is_active: true,
        issued_at: new Date().toISOString(),
        expires_at: validated.induction_expiry || validated.medical_expiry || null,
      });
    }
  }

  // Synchronize with `operators` so employee is selectable across Control Room, Drilling, Production
  if (resolvedCoyNumber && resolvedFullName) {
    try {
      const opTable = supabase.from('operators');
      if (typeof opTable?.select === 'function') {
        const { data: existingOp } = await opTable
          .select('id')
          .eq('employee_code', resolvedCoyNumber)
          .maybeSingle();

        if (existingOp?.id) {
          await supabase
            .from('operators')
            .update({
              full_name: resolvedFullName,
              role: validated.job_title || 'operator',
              active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOp.id);
        } else {
          await supabase.from('operators').insert({
            full_name: resolvedFullName,
            employee_code: resolvedCoyNumber,
            role: validated.job_title || 'operator',
            active: true,
          });
        }
      }
    } catch {
      // Database trigger trg_sync_employee_to_operators serves as automated synchronization fallback
    }
  }

  await revokePrivilegeCache(supabase, targetEmployeeId);

  await cacheInvalidateTags([
    'table:employees',
    'table:personnel',
    'table:badges',
    'table:operators',
    'table:employee_department_access',
  ]);
  revalidatePath('/admin');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room/shift-compilation');
  return { success: true };
}
