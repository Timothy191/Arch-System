'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ConflictError, DatabaseError, ValidationError } from '@/lib/errors/error-classes';

const provisionEmployeeSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().min(1, 'Surname is required').max(100),
  id_number: z.string().trim().min(1, 'ID number is required').max(50),
  job_title: z.string().trim().min(1, 'Job title is required').max(100),
  department_id: z.string().uuid().nullable().optional(),
  area: z.string().trim().optional(),
  medical_expiry: z.string().nullable().optional(),
  induction_expiry: z.string().nullable().optional(),
  qr_code: z.string().trim().optional(),
  photo_url: z.string().trim().nullable().optional(),
  emp_code: z.string().trim().optional(),
});

export type ProvisionEmployeeInput = z.infer<typeof provisionEmployeeSchema>;

const updateEmployeeSchema = z.object({
  id: z.string().uuid('Invalid employee ID'),
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().min(1, 'Surname is required').max(100),
  id_number: z.string().trim().min(1, 'ID number is required').max(50),
  job_title: z.string().trim().min(1, 'Job title is required').max(100),
  department_id: z.string().uuid().nullable().optional(),
  area: z.string().trim().optional(),
  medical_expiry: z.string().nullable().optional(),
  induction_expiry: z.string().nullable().optional(),
  qr_code: z.string().trim().optional(),
  photo_url: z.string().trim().nullable().optional(),
  status: z.string().trim().default('Active'),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export interface ProvisionedEmployeeResult {
  id: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string | null;
  department_id: string | null;
  area_name?: string | null;
  medical_expiry: string | null;
  induction_expiry: string | null;
  photo_url: string | null;
  status: string;
  badge?: {
    id: string;
    qr_code: string;
    is_active: boolean;
  } | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
  display_name: string;
}

/**
 * Retrieve reference departments and existing provisioned personnel
 */
export async function getProvisioningReferenceData(): Promise<{
  departments: DepartmentOption[];
  recentPersonnel: ProvisionedEmployeeResult[];
}> {
  const supabase = await createServerSupabaseClient();

  const [deptRes, persRes] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, display_name')
      .order('display_name', { ascending: true }),
    supabase
      .from('personnel')
      .select(`
        id,
        emp_code,
        first_name,
        surname,
        id_number,
        job_title,
        department_id,
        induction_expiry,
        medical_expiry,
        photo_url,
        status,
        departments (name, display_name),
        badges (id, qr_code, is_active)
      `)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const departments: DepartmentOption[] = (deptRes.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    display_name: d.display_name || d.name,
  }));

  const recentPersonnel: ProvisionedEmployeeResult[] = (persRes.data ?? []).map((p: any) => {
    const badge = Array.isArray(p.badges) ? p.badges[0] : p.badges;
    const dept = p.departments;
    return {
      id: p.id,
      emp_code: p.emp_code,
      first_name: p.first_name,
      surname: p.surname,
      id_number: p.id_number,
      job_title: p.job_title,
      department_id: p.department_id,
      area_name: dept?.display_name || dept?.name || null,
      medical_expiry: p.medical_expiry,
      induction_expiry: p.induction_expiry,
      photo_url: p.photo_url,
      status: p.status || 'Active',
      badge: badge
        ? {
            id: badge.id,
            qr_code: badge.qr_code,
            is_active: badge.is_active ?? true,
          }
        : null,
    };
  });

  return { departments, recentPersonnel };
}

/**
 * Server Action: Provision a complete employee record across Personnel and Badges
 * Includes Name, Surname, ID No, Job Title, Area, Medical Expiry, Induction Expiry, QR Code, and Photo.
 */
export async function provisionNewEmployee(
  rawInput: ProvisionEmployeeInput
): Promise<{ success: boolean; data: ProvisionedEmployeeResult; error?: string }> {
  const parseResult = provisionEmployeeSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    throw new ValidationError(issue?.message || 'Invalid employee details provided');
  }

  const input = parseResult.data;
  const supabase = await createServerSupabaseClient();

  // Resolve department_id if an area string was passed instead of uuid
  let targetDeptId = input.department_id || null;
  if (!targetDeptId && input.area) {
    const { data: deptMatch } = await supabase
      .from('departments')
      .select('id')
      .or(`name.eq."${input.area}",display_name.eq."${input.area}"`)
      .limit(1)
      .maybeSingle();

    if (deptMatch) {
      targetDeptId = deptMatch.id;
    }
  }

  // Check for unique ID number collision
  const { data: existingId } = await supabase
    .from('personnel')
    .select('id, emp_code, first_name, surname')
    .eq('id_number', input.id_number)
    .maybeSingle();

  if (existingId) {
    throw new ConflictError(
      `An employee with ID Number "${input.id_number}" already exists (${existingId.first_name} ${existingId.surname}, ${existingId.emp_code}).`,
      { context: { id_number: input.id_number, existing_emp_code: existingId.emp_code } }
    );
  }

  // Auto-generate employee code if missing
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const empCode = input.emp_code?.trim() || `EMP-${randomSuffix}`;

  // Auto-generate QR code if missing
  const qrCode =
    input.qr_code?.trim() ||
    `QR-${empCode}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // 1. Insert into personnel table
  const personnelPayload = {
    emp_code: empCode,
    first_name: input.first_name,
    surname: input.surname,
    id_number: input.id_number,
    job_title: input.job_title,
    department_id: targetDeptId,
    medical_expiry: input.medical_expiry ? new Date(input.medical_expiry).toISOString() : null,
    induction_expiry: input.induction_expiry
      ? new Date(input.induction_expiry).toISOString()
      : null,
    photo_url: input.photo_url || null,
    status: 'Active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: newPersonnel, error: persError } = await supabase
    .from('personnel')
    .insert(personnelPayload)
    .select()
    .single();

  if (persError || !newPersonnel) {
    throw new DatabaseError('Failed to create employee personnel record', {
      table: 'personnel',
      cause: persError ?? undefined,
    });
  }

  // 2. Insert into badges table for QR code access
  const badgePayload = {
    qr_code: qrCode,
    entity_type: 'personnel' as const,
    personnel_id: newPersonnel.id,
    department_id: targetDeptId,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: input.induction_expiry
      ? new Date(input.induction_expiry).toISOString()
      : input.medical_expiry
        ? new Date(input.medical_expiry).toISOString()
        : null,
  };

  const { data: newBadge, error: badgeError } = await supabase
    .from('badges')
    .insert(badgePayload)
    .select()
    .single();

  if (badgeError) {
    // Note: personnel was created, log warning if badge fails
    console.error('Personnel created but badge registration failed:', badgeError);
  }

  // 3. Synchronize with operators table so personnel is selectable in Control Room, Drilling, Production
  const fullName = `${input.first_name} ${input.surname}`.trim();
  if (empCode && fullName) {
    const { data: existingOp } = await supabase
      .from('operators')
      .select('id')
      .eq('employee_code', empCode)
      .maybeSingle();

    if (existingOp?.id) {
      await supabase
        .from('operators')
        .update({
          full_name: fullName,
          role: input.job_title || 'operator',
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOp.id);
    } else {
      await supabase.from('operators').insert({
        full_name: fullName,
        employee_code: empCode,
        role: input.job_title || 'operator',
        active: true,
      });
    }
  }

  await cacheInvalidateTags([
    'table:personnel',
    'table:badges',
    'table:operators',
    'table:employees',
  ]);

  // Revalidate respective consumer routes
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/card-actions');
  revalidatePath('/access-control/qr-codes');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room/shift-compilation');
  revalidatePath('/database/panels');

  return {
    success: true,
    data: {
      id: newPersonnel.id,
      emp_code: newPersonnel.emp_code,
      first_name: newPersonnel.first_name,
      surname: newPersonnel.surname,
      id_number: newPersonnel.id_number,
      job_title: newPersonnel.job_title,
      department_id: newPersonnel.department_id,
      medical_expiry: newPersonnel.medical_expiry,
      induction_expiry: newPersonnel.induction_expiry,
      photo_url: newPersonnel.photo_url,
      status: newPersonnel.status,
      badge: newBadge
        ? {
            id: newBadge.id,
            qr_code: newBadge.qr_code,
            is_active: newBadge.is_active ?? true,
          }
        : null,
    },
  };
}

/**
 * Server Action: Update an existing employee's details and synchronize across Supabase
 * Reflects changes to Job Title, Area, Medical Expiry, Induction Expiry, Status, Photo, and Badges
 */
export async function updateEmployeeAction(
  data: UpdateEmployeeInput
): Promise<{ success: boolean; data?: ProvisionedEmployeeResult; error?: string }> {
  const parsed = updateEmployeeSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((e) => e.message).join(', ');
    throw new ValidationError(errorMsg);
  }

  const input = parsed.data;
  const supabase = await createServerSupabaseClient();

  // Resolve department ID if department name / area was passed
  let targetDeptId = input.department_id || null;
  if (!targetDeptId && input.area) {
    const { data: deptMatch } = await supabase
      .from('departments')
      .select('id')
      .or(`name.ilike.%${input.area}%,display_name.ilike.%${input.area}%`)
      .limit(1)
      .maybeSingle();

    if (deptMatch) {
      targetDeptId = deptMatch.id;
    }
  }

  // Check ID Number collision with ANY OTHER employee
  const { data: conflictPersonnel } = await supabase
    .from('personnel')
    .select('id, emp_code, first_name, surname')
    .eq('id_number', input.id_number)
    .neq('id', input.id)
    .maybeSingle();

  if (conflictPersonnel) {
    throw new ConflictError(
      `ID Number "${input.id_number}" is already registered to another employee (${conflictPersonnel.first_name} ${conflictPersonnel.surname}, ${conflictPersonnel.emp_code}).`,
      { context: { id_number: input.id_number, conflict_emp_code: conflictPersonnel.emp_code } }
    );
  }

  // 1. Update public.personnel table
  const personnelUpdatePayload = {
    first_name: input.first_name,
    surname: input.surname,
    id_number: input.id_number,
    job_title: input.job_title,
    department_id: targetDeptId,
    medical_expiry: input.medical_expiry ? new Date(input.medical_expiry).toISOString() : null,
    induction_expiry: input.induction_expiry
      ? new Date(input.induction_expiry).toISOString()
      : null,
    photo_url: input.photo_url || null,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedPersonnel, error: persError } = await supabase
    .from('personnel')
    .update(personnelUpdatePayload)
    .eq('id', input.id)
    .select()
    .single();

  if (persError || !updatedPersonnel) {
    throw new DatabaseError('Failed to update employee personnel record', {
      table: 'personnel',
      cause: persError ?? undefined,
    });
  }

  // 2. Synchronize public.badges table (QR code, department assignment, and expiry)
  const expiresAt = input.induction_expiry
    ? new Date(input.induction_expiry).toISOString()
    : input.medical_expiry
      ? new Date(input.medical_expiry).toISOString()
      : null;

  // Check if existing badge exists for this personnel
  const { data: existingBadge } = await supabase
    .from('badges')
    .select('id, qr_code, is_active')
    .eq('personnel_id', input.id)
    .maybeSingle();

  let finalBadge = existingBadge;

  if (existingBadge) {
    const badgeUpdatePayload: Record<string, unknown> = {
      department_id: targetDeptId,
      expires_at: expiresAt,
    };
    if (input.qr_code?.trim()) {
      badgeUpdatePayload.qr_code = input.qr_code.trim();
    }
    const { data: updatedBadge } = await supabase
      .from('badges')
      .update(badgeUpdatePayload)
      .eq('id', existingBadge.id)
      .select('id, qr_code, is_active')
      .single();

    if (updatedBadge) {
      finalBadge = updatedBadge;
    }
  } else if (input.qr_code?.trim()) {
    // If no badge exists yet, insert one
    const { data: newBadge } = await supabase
      .from('badges')
      .insert({
        qr_code: input.qr_code.trim(),
        entity_type: 'personnel',
        personnel_id: input.id,
        department_id: targetDeptId,
        is_active: true,
        issued_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select('id, qr_code, is_active')
      .single();

    if (newBadge) {
      finalBadge = newBadge;
    }
  }

  // 3. Invalidate distributed cache tags
  try {
    const tagsToInvalidate = ['table:personnel', 'table:badges', 'metrics:access-control'];
    if (targetDeptId) {
      tagsToInvalidate.push(`dept:${targetDeptId}`);
    }
    await cacheInvalidateTags(tagsToInvalidate);
  } catch (err) {
    console.warn('[Cache] Non-fatal tag invalidation notice:', err);
  }

  // 4. Revalidate all dependent routes across the board
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/card-actions');
  revalidatePath('/access-control/qr-codes');
  revalidatePath('/access-control/print-cards');
  revalidatePath('/access-control/muster');
  revalidatePath('/database/panels');
  revalidatePath('/(departments)', 'layout');

  return {
    success: true,
    data: {
      id: updatedPersonnel.id,
      emp_code: updatedPersonnel.emp_code,
      first_name: updatedPersonnel.first_name,
      surname: updatedPersonnel.surname,
      id_number: updatedPersonnel.id_number,
      job_title: updatedPersonnel.job_title,
      department_id: updatedPersonnel.department_id,
      medical_expiry: updatedPersonnel.medical_expiry,
      induction_expiry: updatedPersonnel.induction_expiry,
      photo_url: updatedPersonnel.photo_url,
      status: updatedPersonnel.status,
      badge: finalBadge
        ? {
            id: finalBadge.id,
            qr_code: finalBadge.qr_code,
            is_active: finalBadge.is_active ?? true,
          }
        : null,
    },
  };
}
