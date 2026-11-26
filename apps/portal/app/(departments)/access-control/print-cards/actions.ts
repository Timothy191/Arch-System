'use server';

import { randomBytes } from 'node:crypto';
import {
  printCardRequestSchema,
  safePhotoUrlSchema,
} from '@repo/contract/schemas/access-control.schema';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { cacheInvalidateTags, getRedisClient } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import {
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { sanitizePostgrestFilterValue } from '@/lib/supabase-filter';
import { ACCESS_CONTROL_WRITE_ROLES, assertAccessControlRoleFor } from '../actions/shared';

const PRINTER_HEARTBEAT_TTL_MS = 5 * 60_000;

function createNeo300Limiter(keyPrefix: string): RateLimiter {
  try {
    const redis = getRedisClient();
    return new RateLimiter({
      store: redis ? new RedisStore(redis as never) : new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: 30,
      windowMs: 60_000,
      keyPrefix,
    });
  } catch {
    return new RateLimiter({
      store: new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit: 30,
      windowMs: 60_000,
      keyPrefix,
    });
  }
}

const neo300PrintLimiter = createNeo300Limiter('ratelimit:neo300_print:');

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
  coy_number?: string | null;
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
  coy_number?: string | null;
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

export type FleetCardBadgeCategory = 'vehicle' | 'company-fleet' | 'coal-trucks';

export interface FleetCardBadgeProfile {
  id: string;
  code: string;
  vehicle_type: string;
  make_model: string | null;
  registration_number: string | null;
  status: string;
  category: FleetCardBadgeCategory;
  qr_code: string | null;
  rfid_code: string | null;
  has_card: boolean;
}

async function assertAccessControlRole() {
  return assertAccessControlRoleFor({
    allowedRoles: ACCESS_CONTROL_WRITE_ROLES,
    resource: 'neo300_print',
  });
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

  let { data: printer, error } = await supabase
    .from('card_printers')
    .select('*')
    .ilike('model', '%Neo%300%')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError('Failed to query card printer registry', {
      table: 'card_printers',
      cause: error,
    });
  }

  if (!printer) {
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
    return {
      id: '',
      name: 'Magicard Neo 300 (Unconfigured)',
      model: 'Neo Magic 300',
      cups_name: 'Magicard_Neo300',
      connection_type: 'usb',
      status: 'offline',
      status_message: 'Not Connected — Configure Local Print Bridge or use Browser CR80 Print',
      last_online_at: null,
    };
  }

  const typed = printer as Neo300Printer;
  const lastOnlineMs = typed.last_online_at ? Date.parse(typed.last_online_at) : Number.NaN;
  const hasFreshHeartbeat =
    Number.isFinite(lastOnlineMs) && Date.now() - lastOnlineMs <= PRINTER_HEARTBEAT_TTL_MS;

  return {
    ...typed,
    status: hasFreshHeartbeat && typed.status === 'online' ? 'online' : 'offline',
    status_message:
      hasFreshHeartbeat && typed.status === 'online'
        ? typed.status_message
        : 'Offline — Awaiting local print bridge heartbeat (jobs queue cleanly)',
  };
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

  const sanitizedSearch = search ? sanitizePostgrestFilterValue(search) : '';
  if (sanitizedSearch.length > 0) {
    query = query.or(
      `first_name.ilike.%${sanitizedSearch}%,surname.ilike.%${sanitizedSearch}%,emp_code.ilike.%${sanitizedSearch}%,id_number.ilike.%${sanitizedSearch}%`
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

    if (sanitizedSearch.length > 0) {
      fallbackQuery = fallbackQuery.or(
        `first_name.ilike.%${sanitizedSearch}%,surname.ilike.%${sanitizedSearch}%,emp_code.ilike.%${sanitizedSearch}%,id_number.ilike.%${sanitizedSearch}%`
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
      coy_number:
        ((p as Record<string, unknown>).coy_number as string | null | undefined) ?? p.emp_code,
      first_name: p.first_name,
      surname: p.surname,
      id_number: p.id_number,
      job_title: p.job_title,
      area: (p as Record<string, unknown>).area as string | null | undefined,
      department_id: p.department_id,
      department_name: deptRecord?.display_name ?? undefined,
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

  const empCode = (input.coy_number?.trim() || input.emp_code).trim();
  const firstName = input.first_name.trim();
  const surname = input.surname.trim();
  const idNumber = input.id_number.trim();
  const jobTitle = input.job_title.trim();
  const targetDeptId = input.department_id || employee.department_id || null;

  if (!empCode || !firstName || !surname || !idNumber) {
    throw new ValidationError('Coy Number, First Name, Surname, and ID Number are required');
  }

  const parsedPhoto = safePhotoUrlSchema.safeParse(input.photo_url || null);
  if (!parsedPhoto.success) {
    throw new ValidationError(parsedPhoto.error.issues[0]?.message ?? 'Invalid photo URL');
  }

  let personnelId = input.id;

  const personnelPayload: Record<string, unknown> = {
    emp_code: empCode,
    first_name: firstName,
    surname,
    id_number: idNumber,
    job_title: jobTitle,
    department_id: targetDeptId,
    area: input.area?.trim() || null,
    status: input.status || 'Active',
    induction_expiry: input.induction_expiry || null,
    medical_expiry: input.medical_expiry || null,
    photo_url: parsedPhoto.data ?? null,
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
  const suppliedQr = input.qr_code?.trim() || undefined;
  const desiredRfid = input.rfid_code?.trim() || null;
  let persistedQr: string | null = suppliedQr ?? null;

  const { data: existingBadge } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code')
    .eq('personnel_id', personnelId)
    .eq('is_active', true)
    .maybeSingle();

  if (existingBadge) {
    persistedQr = suppliedQr ?? existingBadge.qr_code;
    const { error: badgeUpdateErr } = await supabase
      .from('badges')
      .update({
        qr_code: suppliedQr ?? existingBadge.qr_code,
        rfid_code: desiredRfid,
        department_id: targetDeptId,
      })
      .eq('id', existingBadge.id)
      .select('id');
    if (badgeUpdateErr) {
      throw new DatabaseError('Failed to update employee badge', {
        table: 'badges',
        cause: badgeUpdateErr,
      });
    }
  } else {
    const generatedQr = `QR-${randomBytes(8).toString('hex').toUpperCase()}`;
    persistedQr = suppliedQr ?? generatedQr;
    const { error: badgeInsertErr } = await supabase.from('badges').insert({
      qr_code: suppliedQr ?? generatedQr,
      rfid_code: desiredRfid,
      entity_type: 'personnel',
      personnel_id: personnelId,
      department_id: targetDeptId,
      is_active: true,
    });
    if (badgeInsertErr) {
      throw new DatabaseError('Failed to create employee badge', {
        table: 'badges',
        cause: badgeInsertErr,
      });
    }
  }

  logger.info({
    event: 'neo300_employee_saved',
    actorId: employee.id,
    personnelId,
    departmentId: targetDeptId,
  });

  await cacheInvalidateTags([
    'table:personnel',
    'table:badges',
    ...(targetDeptId ? [`dept:${targetDeptId}`] : []),
  ]);
  revalidatePath('/access-control/print-cards');
  revalidatePath('/access-control/card-actions');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/muster');
  revalidatePath('/access-control');
  revalidatePath('/control-room/machine-operations');

  const updatedList = await getEmployeeCardProfiles(empCode);
  const found = updatedList.find((p) => p.id === personnelId) ?? updatedList[0];
  if (found) return found;

  return {
    id: personnelId!,
    emp_code: empCode,
    coy_number: empCode,
    first_name: firstName,
    surname,
    id_number: idNumber,
    job_title: jobTitle,
    area: input.area?.trim() || null,
    department_id: targetDeptId,
    induction_expiry: input.induction_expiry || null,
    medical_expiry: input.medical_expiry || null,
    status: input.status || 'Active',
    qr_code: persistedQr,
    rfid_code: desiredRfid,
    has_card: true,
    photo_url: input.photo_url || null,
  };
}

/**
 * Send an employee card print job to the Magicard Neo 300
 */
export async function sendNeo300PrintJob(personnelId: string) {
  const { supabase, employee, departmentId } = await assertAccessControlRole();
  const parsed = printCardRequestSchema.safeParse({ personnelId, printCopies: 1 });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid personnel ID');
  }

  const { allowed } = await neo300PrintLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Print job rate limit exceeded. Please wait.');
  }

  const { data: person, error: personErr } = await supabase
    .from('personnel')
    .select('id, first_name, surname, job_title, emp_code, induction_expiry')
    .eq('id', parsed.data.personnelId)
    .single();

  if (personErr || !person) {
    throw new DatabaseError('Personnel not found', { table: 'personnel', cause: personErr });
  }

  let { data: badge } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code')
    .eq('personnel_id', parsed.data.personnelId)
    .eq('is_active', true)
    .maybeSingle();

  if (!badge) {
    const generatedQr = `QR-${randomBytes(8).toString('hex').toUpperCase()}`;
    const { data: newBadge, error: bError } = await supabase
      .from('badges')
      .insert({
        qr_code: generatedQr,
        entity_type: 'personnel',
        personnel_id: parsed.data.personnelId,
        department_id: departmentId ?? employee.department_id,
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

  const { data: job, error: jobError } = await supabase
    .from('print_jobs')
    .insert({
      personnel_id: person.id,
      employee_name: `${person.first_name} ${person.surname}`,
      role_title: person.job_title,
      qr_code_data: badge?.qr_code,
      status: 'queued',
      printer_id: printer.id || null,
      created_by: employee.id,
      expires_at: person.induction_expiry ?? undefined,
      note: 'Queued for Print Bridge',
    })
    .select()
    .single();

  if (jobError) {
    throw new DatabaseError('Failed to queue print job for Neo 300', {
      table: 'print_jobs',
      cause: jobError,
    });
  }

  logger.info({
    event: 'neo300_print_job_queued',
    actorId: employee.id,
    personnelId: person.id,
    jobId: job.id,
  });

  await cacheInvalidateTags([
    'table:print_jobs',
    'table:badges',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
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
  const { supabase, employee, departmentId } = await assertAccessControlRole();

  const { data: cancelledRows, error } = await supabase
    .from('print_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId)
    .select('id');

  if (error) {
    throw new DatabaseError('Failed to cancel job', { table: 'print_jobs', cause: error });
  }
  if (!cancelledRows || cancelledRows.length === 0) {
    throw new ForbiddenError('Print job cancel blocked or job not found', {
      resource: 'print_jobs',
      action: 'cancel',
    });
  }

  logger.info({
    event: 'neo300_print_job_cancelled',
    actorId: employee.id,
    jobId,
  });

  await cacheInvalidateTags([
    'table:print_jobs',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control/print-cards');
  return { success: true };
}

const FLEET_PROFILE_LIMIT = 100;

function classifyFleetBadgeCategory(
  vehicleType: string,
  fleetCode: string
): FleetCardBadgeCategory {
  const normalized = `${vehicleType} ${fleetCode}`.toLowerCase();
  if (/(coal|haul|adt|dump|tipper|truck)/.test(normalized)) {
    return 'coal-trucks';
  }
  if (/(company|service|utility|bowser|support|bus|van|pickup)/.test(normalized)) {
    return 'company-fleet';
  }
  return 'vehicle';
}

/**
 * Retrieve active fleet and vehicle units paired with their active QR/RFID badges
 * for category tabs (Vehicle, Company Fleet, Coal Trucks) in Neo 300 Print Studio.
 */
export async function getFleetAndVehicleBadgeProfiles(): Promise<FleetCardBadgeProfile[]> {
  try {
    const { supabase } = await assertAccessControlRole();
    const { data: fleetRows, error } = await supabase
      .from('fleet')
      .select('id, fleet_code, vehicle_type, make, model, registration_number, status')
      .order('fleet_code', { ascending: true })
      .limit(FLEET_PROFILE_LIMIT);

    if (error || !fleetRows || fleetRows.length === 0) {
      return [];
    }

    const fleetIds = fleetRows.map((row) => row.id);
    const { data: badges } = await supabase
      .from('badges')
      .select('fleet_id, qr_code, rfid_code, is_active')
      .in('fleet_id', fleetIds)
      .eq('is_active', true);

    const badgeByFleetId = new Map<string, { qr_code: string; rfid_code: string | null }>();
    for (const badge of badges ?? []) {
      if (badge.fleet_id) {
        badgeByFleetId.set(badge.fleet_id, {
          qr_code: badge.qr_code,
          rfid_code: badge.rfid_code,
        });
      }
    }

    return fleetRows.map((row) => {
      const badge = badgeByFleetId.get(row.id);
      const makeModel = [row.make, row.model].filter(Boolean).join(' ') || null;
      return {
        id: row.id,
        code: row.fleet_code,
        vehicle_type: row.vehicle_type,
        make_model: makeModel,
        registration_number: row.registration_number,
        status: row.status,
        category: classifyFleetBadgeCategory(row.vehicle_type, row.fleet_code),
        qr_code: badge?.qr_code ?? null,
        rfid_code: badge?.rfid_code ?? null,
        has_card: Boolean(badge),
      };
    });
  } catch {
    return [];
  }
}
