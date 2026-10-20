'use server';

import { AuthError, DatabaseError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

export interface AdminDepartmentOption {
  id: string;
  display_name: string;
}

export interface AdminEmployeeRecord {
  id: string;
  auth_id?: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
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
  created_at: string;
  departments?: {
    display_name: string;
  } | null;
}

export interface UpsertAdminEmployeeInput {
  id?: string | null;
  names: string;
  surname: string;
  full_name: string;
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
}

interface RawEmployeeRow {
  id: string;
  auth_id?: string | null;
  department_id: string | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
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

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(error.message?.includes('does not exist')) ||
    Boolean(error.message?.includes('schema cache'))
  );
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
 * Load employees, departments, and linked personnel/badges on the server so
 * HttpOnly Supabase auth cookies are forwarded and RLS evaluates as the signed-in admin.
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

  const [empResult, deptResult, persResult] = await Promise.all([
    supabase
      .from('employees')
      .select('*, departments(display_name)')
      .order('created_at', { ascending: false }),
    supabase.from('departments').select('id, display_name'),
    supabase.from('personnel').select('*, badges(qr_code)'),
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

  const persRows = (persResult.data ?? []) as RawPersonnelRow[];
  const persByCode = new Map<string, RawPersonnelRow>();
  const persByName = new Map<string, RawPersonnelRow>();

  for (const p of persRows) {
    if (p.emp_code) {
      persByCode.set(p.emp_code.trim().toUpperCase(), p);
    }
    const fullNameKey = `${p.first_name ?? ''} ${p.surname ?? ''}`.trim().toLowerCase();
    if (fullNameKey) {
      persByName.set(fullNameKey, p);
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

    return {
      id: emp.id,
      auth_id: emp.auth_id ?? null,
      full_name: emp.full_name,
      first_name: emp.first_name ?? linked?.first_name ?? derivedFirstName,
      last_name: emp.last_name ?? linked?.surname ?? derivedLastName,
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
      accessible_departments: emp.accessible_departments ?? null,
      created_at: emp.created_at,
      departments: normalizeDepartmentJoin(emp.departments, deptMap, resolvedDepartmentId),
    };
  });

  // Include any provisioned personnel rows that do not yet have a linked employees row
  for (const p of persRows) {
    const codeKey = p.emp_code?.trim().toUpperCase() ?? '';
    if (codeKey && matchedPersonnelCodes.has(codeKey)) {
      continue;
    }
    const fullName = `${p.first_name ?? ''} ${p.surname ?? ''}`.trim() || p.emp_code;
    const resolvedDeptId = p.department_id ?? null;
    enrichedEmployees.push({
      id: p.id,
      auth_id: null,
      full_name: fullName,
      first_name: p.first_name ?? null,
      last_name: p.surname ?? null,
      national_id: p.id_number ?? null,
      job_title: p.job_title ?? null,
      areas: p.area ? [p.area] : null,
      medical_expiry_date: p.medical_expiry ?? null,
      induction_expiry_date: p.induction_expiry ?? null,
      employee_code: p.emp_code,
      qr_code_data: extractBadgeQr(p.badges),
      photo_url: p.photo_url ?? null,
      role: 'operator',
      department_id: resolvedDeptId,
      accessible_departments: resolvedDeptId ? [resolvedDeptId] : [],
      created_at: p.created_at ?? new Date().toISOString(),
      departments: normalizeDepartmentJoin(null, deptMap, resolvedDeptId),
    });
  }

  return {
    employees: enrichedEmployees,
    departments,
  };
}

/**
 * Create or update an employee across `employees`, `personnel`, and `badges`.
 * Gracefully handles cloud schema drift when migrations 037 or 080 are not yet applied.
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

  const resolvedFullName =
    formData.full_name.trim() || `${formData.names.trim()} ${formData.surname.trim()}`.trim();

  const namePrefix = (formData.names.trim() || resolvedFullName || 'EMP')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const deterministicSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const resolvedCoyNumber =
    formData.coy_number.trim() || `EMP-${namePrefix || 'STAFF'}-${deterministicSuffix}`;

  const extendedEmployeeColumns = {
    full_name: resolvedFullName,
    first_name: formData.names.trim() || null,
    last_name: formData.surname.trim() || null,
    national_id: formData.id_number.trim() || null,
    job_title: formData.job_title.trim() || null,
    areas: formData.area.trim() ? [formData.area.trim()] : [],
    medical_expiry_date: formData.medical_expiry || null,
    induction_expiry_date: formData.induction_expiry || null,
    employee_code: resolvedCoyNumber,
    qr_code_data: formData.qr_code.trim() || null,
    photo_url: formData.photo_url || null,
    role: formData.role,
    department_id: formData.department_id,
    accessible_departments: formData.accessible_departments,
  };

  const coreEmployeeColumns = {
    full_name: resolvedFullName,
    employee_code: resolvedCoyNumber,
    role: formData.role,
    department_id: formData.department_id,
    accessible_departments: formData.accessible_departments,
  };

  let targetEmployeeId: string | null = null;
  if (formData.id) {
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', formData.id)
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
  } else if (!formData.id) {
    // Creating a new employee entry
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
  }

  // Synchronize with `personnel` + `badges`
  const firstName = formData.names.trim() || resolvedFullName.split(/\s+/)[0] || 'Employee';
  const surname =
    formData.surname.trim() || resolvedFullName.split(/\s+/).slice(1).join(' ') || 'Record';
  const idNumber = formData.id_number.trim() || resolvedCoyNumber;
  const qrCode = formData.qr_code.trim() || `QR-${resolvedCoyNumber}`;

  let personnelId: string | null = null;
  if (formData.id) {
    const { data: byPersId } = await supabase
      .from('personnel')
      .select('id')
      .eq('id', formData.id)
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
    job_title: formData.job_title.trim() || null,
    department_id: formData.department_id,
    medical_expiry: formData.medical_expiry || null,
    induction_expiry: formData.induction_expiry || null,
    photo_url: formData.photo_url || null,
  };

  if (personnelId) {
    const updateWithArea = {
      ...basePersonnelFields,
      area: formData.area.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let { error: persUpdateErr } = await supabase
      .from('personnel')
      .update(updateWithArea)
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
    const insertWithArea = {
      ...basePersonnelFields,
      area: formData.area.trim() || null,
      status: 'Active',
    };
    let { data: insertedPers, error: persInsertErr } = await supabase
      .from('personnel')
      .insert(insertWithArea)
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
          department_id: formData.department_id,
          expires_at: formData.induction_expiry || formData.medical_expiry || null,
        })
        .eq('id', existingBadge.id);
    } else {
      await supabase.from('badges').insert({
        qr_code: qrCode,
        entity_type: 'personnel',
        personnel_id: personnelId,
        department_id: formData.department_id,
        is_active: true,
        issued_at: new Date().toISOString(),
        expires_at: formData.induction_expiry || formData.medical_expiry || null,
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
              role: formData.job_title || 'operator',
              active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOp.id);
        } else {
          await supabase.from('operators').insert({
            full_name: resolvedFullName,
            employee_code: resolvedCoyNumber,
            role: formData.job_title || 'operator',
            active: true,
          });
        }
      }
    } catch {
      // Database trigger trg_sync_employee_to_operators serves as automated synchronization fallback
    }
  }

  await cacheInvalidateTags([
    'table:employees',
    'table:personnel',
    'table:badges',
    'table:operators',
  ]);
  revalidatePath('/admin');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room/shift-compilation');
  return { success: true };
}
