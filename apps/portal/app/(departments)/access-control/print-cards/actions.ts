'use server';

import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { AuthError, DatabaseError, ForbiddenError } from '@/lib/errors/error-classes';

export interface Neo300Printer {
  id: string;
  name: string;
  model: string;
  cups_name: string;
  connection_type: string;
  status: string;
  status_message: string | null;
  last_online_at: string | null;
}

export interface EmployeeCardProfile {
  id: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string | null;
  area?: string | null;
  department_id: string | null;
  department_name?: string;
  induction_expiry: string | null;
  medical_expiry: string | null;
  status: string;
  qr_code: string | null;
  rfid_code: string | null;
  has_card: boolean;
  photo_url?: string | null;
}

export interface CardStudioDepartment {
  id: string;
  name: string;
  display_name: string;
}

export interface UpsertEmployeeCardInput {
  id?: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string;
  department_id: string | null;
  area?: string | null;
  status?: string;
  induction_expiry?: string | null;
  medical_expiry?: string | null;
  photo_url?: string | null;
  rfid_code?: string | null;
  qr_code?: string | null;
}

export interface CardPrintJob {
  id: string;
  personnel_id: string | null;
  employee_name: string;
  role_title: string | null;
  qr_code_data: string | null;
  status: string;
  created_at: string;
  printer_id: string | null;
}

async function assertAccessControlRole() {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) throw new AuthError('Unauthorized');

  if (!['admin', 'access_control', 'supervisor'].includes(principal.employee.role)) {
    throw new ForbiddenError('Forbidden: access_control or admin role required', {
      resource: 'neo300_print',
      action: 'assert_role',
    });
  }

  return { supabase, user: principal.user, employee: principal.employee };
}

/**
 * Retrieve departments list for employee card assignment
 */
export async function getDepartmentsForCardStudio(): Promise<CardStudioDepartment[]> {
  const { supabase } = await assertAccessControlRole();
  const { data } = await supabase
    .from('departments')
    .select('id, name, display_name')
    .order('display_name', { ascending: true });

  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    display_name: d.display_name || d.name,
  }));
}

/**
 * Get or register the Magicard Neo 300 card printer
 */
export async function getNeo300PrinterStatus(): Promise<Neo300Printer> {
  const { supabase } = await assertAccessControlRole();

  let { data: printer } = await supabase
    .from('card_printers')
    .select('*')
    .ilike('model', '%Neo%300%')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!printer) {
    // Check by cups_name
    const { data: byName } = await supabase
      .from('card_printers')
      .select('*')
      .ilike('cups_name', '%Neo%')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    printer = byName;
  }

  if (!printer) {
    // Auto-register default Neo 300 printer
    const { data: inserted, error } = await supabase
      .from('card_printers')
      .insert({
        cups_name: 'Magicard_Neo300',
        name: 'Security Gate Neo300 Card Printer',
        model: 'Neo Magic 300',
        connection_type: 'usb',
        status: 'online',
        status_message: 'Ready to print ID cards',
        last_online_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Failed to register Neo 300 printer', {
        table: 'card_printers',
        cause: error,
      });
    }
    printer = inserted;
  }

  return printer as Neo300Printer;
}

/**
 * Search and retrieve employees for badge printing
 */
export async function getEmployeeCardProfiles(search?: string): Promise<EmployeeCardProfile[]> {
  const { supabase } = await assertAccessControlRole();

  let query = supabase
    .from('personnel')
    .select(
      `
      id,
      emp_code,
      first_name,
      surname,
      id_number,
      job_title,
      area,
      department_id,
      induction_expiry,
      medical_expiry,
      status,
      photo_url,
      departments:department_id(display_name)
    `
    )
    .order('surname', { ascending: true })
    .limit(100);

  if (search && search.trim().length > 0) {
    const s = search.trim();
    query = query.or(
      `first_name.ilike.%${s}%,surname.ilike.%${s}%,emp_code.ilike.%${s}%,id_number.ilike.%${s}%`
    );
  }

  let { data: personnelList, error } = await query;

  if (error) {
    let fallbackQuery = supabase
      .from('personnel')
      .select(
        `
        id,
        emp_code,
        first_name,
        surname,
        id_number,
        job_title,
        department_id,
        induction_expiry,
        medical_expiry,
        status,
        departments:department_id(display_name)
      `
      )
      .order('surname', { ascending: true })
      .limit(100);

    if (search && search.trim().length > 0) {
      const s = search.trim();
      fallbackQuery = fallbackQuery.or(
        `first_name.ilike.%${s}%,surname.ilike.%${s}%,emp_code.ilike.%${s}%,id_number.ilike.%${s}%`
      );
    }

    const fallbackRes = await fallbackQuery;
    if (fallbackRes.error) {
      throw new DatabaseError('Failed to load personnel for card printing', {
        table: 'personnel',
        cause: fallbackRes.error,
      });
    }
    personnelList = (fallbackRes.data ?? []).map((p) => ({
      ...p,
      area: null,
      photo_url: null,
    }));
  }

  if (!personnelList || personnelList.length === 0) {
    return [];
  }

  const personnelIds = personnelList.map((p) => p.id);

  // Fetch active badges
  let { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('personnel_id, qr_code, rfid_code, is_active')
    .in('personnel_id', personnelIds)
    .eq('is_active', true);

  if (badgesError) {
    const fallbackBadges = await supabase
      .from('badges')
      .select('personnel_id, qr_code, is_active')
      .in('personnel_id', personnelIds)
      .eq('is_active', true);
    badges = (fallbackBadges.data ?? []).map((b) => ({
      ...b,
      rfid_code: null,
    }));
  }

  const badgeMap = new Map<string, { qr_code: string; rfid_code: string | null }>();
  (badges ?? []).forEach((b) => {
    if (b.personnel_id) {
      badgeMap.set(b.personnel_id, { qr_code: b.qr_code, rfid_code: b.rfid_code });
    }
  });

  return personnelList.map((p) => {
    const badge = badgeMap.get(p.id);
    const deptRecord = p.departments as unknown as { display_name: string } | null;
    const rawPhotoUrl =
      ((p as Record<string, unknown>).photo_url as string | null | undefined) ??
      ((p as Record<string, unknown>).photo_path as string | null | undefined);
    return {
      id: p.id,
      emp_code: p.emp_code,
      first_name: p.first_name,
      surname: p.surname,
      id_number: p.id_number,
      job_title: p.job_title,
      area: (p as Record<string, unknown>).area as string | null | undefined,
      department_id: p.department_id,
      department_name: deptRecord?.display_name ?? 'General Operations',
      induction_expiry: p.induction_expiry,
      medical_expiry: p.medical_expiry,
      status: p.status,
      qr_code: badge?.qr_code ?? null,
      rfid_code: badge?.rfid_code ?? null,
      has_card: !!badge,
      photo_url: rawPhotoUrl ?? null,
    };
  });
}

/**
 * Create or update an employee in `personnel`, issue/update their active `badges` row
 * (QR + RFID), and sync them into `operators` so they are available across all departments.
 */
export async function upsertEmployeeForCardPrinting(
  input: UpsertEmployeeCardInput
): Promise<EmployeeCardProfile> {
  const { supabase, employee } = await assertAccessControlRole();

  const empCode = input.emp_code.trim().toUpperCase();
  const firstName = input.first_name.trim();
  const surname = input.surname.trim();
  const idNumber = input.id_number.trim();
  const jobTitle = input.job_title.trim() || 'Site Operator';
  const targetDeptId = input.department_id || employee.department_id || null;

  if (!empCode || !firstName || !surname || !idNumber) {
    throw new DatabaseError('Employee Code, First Name, Surname, and ID Number are required', {
      table: 'personnel',
    });
  }

  let personnelId = input.id;

  const personnelPayload: Record<string, unknown> = {
    emp_code: empCode,
    first_name: firstName,
    surname,
    id_number: idNumber,
    job_title: jobTitle,
    department_id: targetDeptId,
    area: input.area?.trim() || 'Main Complex',
    status: input.status || 'Active',
    induction_expiry: input.induction_expiry || null,
    medical_expiry: input.medical_expiry || null,
    photo_url: input.photo_url || null,
  };

  if (personnelId) {
    const { error: updateErr } = await supabase
      .from('personnel')
      .update(personnelPayload)
      .eq('id', personnelId);

    if (updateErr) {
      throw new DatabaseError('Failed to update employee profile for card printing', {
        table: 'personnel',
        cause: updateErr,
      });
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('personnel')
      .insert(personnelPayload)
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw new DatabaseError('Failed to create employee in database', {
        table: 'personnel',
        cause: insertErr,
      });
    }
    personnelId = inserted.id;
  }

  // Ensure active badge (QR + RFID) is provisioned for the card
  const desiredQr = input.qr_code?.trim() || `EMP-${empCode}`;
  const desiredRfid = input.rfid_code?.trim() || null;

  const { data: existingBadge } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code')
    .eq('personnel_id', personnelId)
    .eq('is_active', true)
    .maybeSingle();

  if (existingBadge) {
    await supabase
      .from('badges')
      .update({
        qr_code: desiredQr,
        rfid_code: desiredRfid,
        department_id: targetDeptId,
      })
      .eq('id', existingBadge.id);
  } else {
    await supabase.from('badges').insert({
      qr_code: desiredQr,
      rfid_code: desiredRfid,
      entity_type: 'personnel',
      personnel_id: personnelId,
      department_id: targetDeptId,
      is_active: true,
    });
  }

  // Also sync directly to operators table so Control Room, Drilling & Production see this employee immediately
  try {
    await supabase.from('operators').upsert(
      {
        full_name: `${firstName} ${surname}`,
        employee_code: empCode,
        role: jobTitle,
        active: (input.status || 'Active').toLowerCase() === 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_code' }
    );
  } catch {
    // Handled by DB trigger trg_sync_personnel_to_operators when migration 189 is active
  }

  revalidatePath('/access-control/print-cards');
  revalidatePath('/access-control/card-actions');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/muster');
  revalidatePath('/control-room/machine-operations');

  const updatedList = await getEmployeeCardProfiles(empCode);
  const found = updatedList.find((p) => p.id === personnelId) ?? updatedList[0];
  if (found) return found;

  return {
    id: personnelId!,
    emp_code: empCode,
    first_name: firstName,
    surname,
    id_number: idNumber,
    job_title: jobTitle,
    area: input.area?.trim() || 'Main Complex',
    department_id: targetDeptId,
    department_name: 'Assigned Department',
    induction_expiry: input.induction_expiry || null,
    medical_expiry: input.medical_expiry || null,
    status: input.status || 'Active',
    qr_code: desiredQr,
    rfid_code: desiredRfid,
    has_card: true,
    photo_url: input.photo_url || null,
  };
}

/**
 * Send an employee card print job to the Magicard Neo 300
 */
export async function sendNeo300PrintJob(personnelId: string) {
  const { supabase, employee } = await assertAccessControlRole();

  const { data: person } = await supabase
    .from('personnel')
    .select('id, first_name, surname, job_title, emp_code, induction_expiry')
    .eq('id', personnelId)
    .single();

  if (!person) {
    throw new DatabaseError('Personnel not found', { table: 'personnel' });
  }

  // Check or create badge if missing
  let { data: badge } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code')
    .eq('personnel_id', personnelId)
    .eq('is_active', true)
    .maybeSingle();

  if (!badge) {
    const generatedQr = `EMP-${person.emp_code || person.id.substring(0, 8).toUpperCase()}`;
    const { data: newBadge, error: bError } = await supabase
      .from('badges')
      .insert({
        qr_code: generatedQr,
        entity_type: 'personnel',
        personnel_id: personnelId,
        department_id: employee.department_id,
        is_active: true,
      })
      .select()
      .single();

    if (bError) {
      throw new DatabaseError('Failed to issue badge for printing', {
        table: 'badges',
        cause: bError,
      });
    }
    badge = newBadge;
  }

  const printer = await getNeo300PrinterStatus();

  // Create print job
  const { data: job, error: jobError } = await supabase
    .from('print_jobs')
    .insert({
      personnel_id: person.id,
      employee_name: `${person.first_name} ${person.surname}`,
      role_title: person.job_title,
      qr_code_data: badge?.qr_code,
      status: 'queued',
      printer_id: printer.id,
      created_by: employee.id,
      expires_at: person.induction_expiry ?? undefined,
    })
    .select()
    .single();

  if (jobError) {
    throw new DatabaseError('Failed to dispatch print job to Neo 300', {
      table: 'print_jobs',
      cause: jobError,
    });
  }

  // Update card_printers status to active
  await supabase
    .from('card_printers')
    .update({
      status: 'online',
      last_online_at: new Date().toISOString(),
      status_message: `Printing job #${job.id.substring(0, 8)} for ${person.first_name} ${person.surname}`,
    })
    .eq('id', printer.id);

  revalidatePath('/access-control/print-cards');
  return { success: true, job };
}

/**
 * Get recent card print jobs
 */
export async function getRecentNeo300Jobs(limit = 10): Promise<CardPrintJob[]> {
  const { supabase } = await assertAccessControlRole();

  const { data: jobs, error } = await supabase
    .from('print_jobs')
    .select(
      'id, personnel_id, employee_name, role_title, qr_code_data, status, queued_at, printer_id'
    )
    .order('queued_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new DatabaseError('Failed to load print jobs', {
      table: 'print_jobs',
      cause: error,
    });
  }

  return (jobs ?? []).map((j) => ({
    id: j.id,
    personnel_id: j.personnel_id,
    employee_name: j.employee_name,
    role_title: j.role_title,
    qr_code_data: j.qr_code_data,
    status: j.status,
    created_at:
      (j as { queued_at?: string; created_at?: string }).queued_at ??
      (j as { created_at?: string }).created_at ??
      new Date().toISOString(),
    printer_id: j.printer_id,
  }));
}

/**
 * Cancel a queued print job
 */
export async function cancelNeo300Job(jobId: string) {
  const { supabase } = await assertAccessControlRole();

  const { error } = await supabase
    .from('print_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId);

  if (error) {
    throw new DatabaseError('Failed to cancel job', { table: 'print_jobs', cause: error });
  }

  revalidatePath('/access-control/print-cards');
  return { success: true };
}
