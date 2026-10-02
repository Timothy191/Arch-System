'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { DatabaseError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';
import { assertAccessControlRole } from './shared';

export async function getBadgesForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: badges,
    count,
    error,
  } = await supabase
    .from('badges')
    .select(
      `
      id,
      qr_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel:personnel_id(first_name, surname),
      visitor:visitor_id(first_name, surname),
      fleet:fleet_id(fleet_code, vehicle_type),
      equipment:equipment_id(equip_code, equipment_type)
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .order('issued_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError('Failed to load badges', {
      operation: 'select',
      context: { error: error.message },
    });
  }

  return { badges: badges ?? [], totalCount: count ?? 0 };
}

export async function getVisitorsForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: visitors,
    count,
    error,
  } = await supabase
    .from('visitors')
    .select(
      `
      id,
      first_name,
      surname,
      id_number,
      company,
      visiting,
      reason_for_entry,
      check_in_time,
      check_out_time,
      status
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .order('check_in_time', { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError('Failed to load visitors', {
      operation: 'select',
      context: { error: error.message },
    });
  }

  return { visitors: visitors ?? [], totalCount: count ?? 0 };
}

export async function registerVisitor(formData: FormData) {
  const { supabase, employee } = await assertAccessControlRole();

  const firstName = formData.get('first_name') as string;
  const surname = formData.get('surname') as string;
  const company = formData.get('company') as string;
  const reason = formData.get('reason') as string;

  const { data: visitor, error } = await supabase
    .from('visitors')
    .insert({
      first_name: firstName,
      surname,
      company,
      reason_for_entry: reason,
      department_id: employee.department_id,
      status: 'Checked In',
      check_in_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new DatabaseError('Failed to register visitor', {
      operation: 'insert',
      context: { error: error.message },
    });
  }

  // Also issue a temporary badge
  const qrCode = `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const { error: badgeError } = await supabase.from('badges').insert({
    qr_code: qrCode,
    entity_type: 'Visitor',
    visitor_id: visitor.id,
    department_id: employee.department_id,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
  });

  if (badgeError) {
    logError(
      new DatabaseError('Failed to issue temporary badge for registered visitor', {
        context: { error: badgeError.message, visitorId: visitor.id },
      })
    );
  }

  revalidatePath('/access-control/visitors');
  return { success: true };
}

export async function getAccessLogsForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: logs,
    count,
    error,
  } = await supabase
    .from('access_logs')
    .select(
      `
      id,
      scanned_at,
      gate_location,
      access_granted,
      denial_reason,
      access_type,
      direction,
      badge:badges!inner(qr_code, entity_type, personnel:personnel_id(first_name, surname), visitor:visitor_id(first_name, surname))
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .order('scanned_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError('Failed to load access logs', {
      operation: 'select',
      context: { error: error.message },
    });
  }

  return { logs: logs ?? [], totalCount: count ?? 0 };
}
