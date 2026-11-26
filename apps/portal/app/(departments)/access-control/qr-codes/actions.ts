'use server';

import { randomBytes } from 'node:crypto';
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
import { assertAccessControlRoleFor, resolveAccessControlDeptId } from '../actions/shared';

function createQrLimiter(keyPrefix: string): RateLimiter {
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

const qrMutationLimiter = createQrLimiter('ratelimit:qr_management:');

export type CredentialEntityType = 'personnel' | 'vehicle' | 'coal_truck' | 'visitor' | 'equipment';

export interface BadgeInventoryItem {
  id: string;
  qr_code: string;
  rfid_code: string | null;
  entity_type: string;
  is_active: boolean;
  issued_at: string;
  expires_at: string | null;
  entity_name: string;
  entity_subtitle: string;
  entity_id: string | null;
  status: string;
}

export interface EntityOption {
  id: string;
  label: string;
  sublabel: string;
  type: CredentialEntityType;
}

const QR_MANAGEMENT_ROLES = ['admin', 'access_control'] as const;

async function assertAccessControlRole() {
  return assertAccessControlRoleFor({
    allowedRoles: QR_MANAGEMENT_ROLES,
    resource: 'qr_management',
  });
}

/**
 * Get all badges inventory joined with their specific entity details
 */
export async function getBadgesInventory(
  filterType?: string,
  search?: string
): Promise<BadgeInventoryItem[]> {
  const { supabase } = await assertAccessControlRole();

  let query = supabase
    .from('badges')
    .select(
      `
      id,
      qr_code,
      rfid_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel_id,
      visitor_id,
      fleet_id,
      equipment_id,
      personnel:personnel_id(id, first_name, surname, emp_code, status, job_title),
      visitor:visitor_id(id, first_name, surname, company, status),
      fleet:fleet_id(id, fleet_code, vehicle_type, registration_number, make, model, status),
      equipment:equipment_id(id, equip_code, equipment_type, status)
    `
    )
    .order('issued_at', { ascending: false })
    .limit(100);

  if (filterType && filterType !== 'all') {
    if (filterType === 'coal_truck') {
      query = query.in('entity_type', ['vehicle', 'fleet']);
    } else if (filterType === 'vehicle') {
      query = query.in('entity_type', ['vehicle', 'fleet']);
    } else {
      query = query.eq('entity_type', filterType);
    }
  }

  const sanitizedSearch = search ? sanitizePostgrestFilterValue(search) : '';
  if (sanitizedSearch.length > 0) {
    query = query.or(`qr_code.ilike.%${sanitizedSearch}%,rfid_code.ilike.%${sanitizedSearch}%`);
  }

  const { data: primaryBadges, error } = await query;
  let badges: Array<Record<string, unknown>> = (primaryBadges ?? []) as Array<
    Record<string, unknown>
  >;

  if (error) {
    let fallbackQuery = supabase
      .from('badges')
      .select(
        `
        id,
        qr_code,
        entity_type,
        is_active,
        issued_at,
        personnel_id,
        visitor_id,
        personnel:personnel_id(id, first_name, surname, emp_code, status, job_title),
        visitor:visitor_id(id, name, company, status)
      `
      )
      .order('issued_at', { ascending: false })
      .limit(100);

    if (filterType && filterType !== 'all') {
      if (filterType === 'coal_truck' || filterType === 'vehicle') {
        fallbackQuery = fallbackQuery.in('entity_type', ['vehicle', 'fleet']);
      } else {
        fallbackQuery = fallbackQuery.eq('entity_type', filterType);
      }
    }

    if (sanitizedSearch.length > 0) {
      fallbackQuery = fallbackQuery.ilike('qr_code', `%${sanitizedSearch}%`);
    }

    const fallbackRes = await fallbackQuery;
    if (fallbackRes.error) {
      throw new DatabaseError('Failed to load badges inventory', {
        table: 'badges',
        cause: fallbackRes.error,
      });
    }

    badges = (fallbackRes.data ?? []).map((b) => {
      const rawV = b.visitor as unknown as {
        id: string;
        name?: string;
        company?: string;
        status: string;
      } | null;
      const [firstName = '', ...rest] = (rawV?.name ?? '').split(' ');
      return {
        ...b,
        rfid_code: null,
        expires_at: null,
        fleet_id: null,
        equipment_id: null,
        visitor: rawV
          ? {
              id: rawV.id,
              first_name: firstName,
              surname: rest.join(' '),
              company: rawV.company,
              status: rawV.status,
            }
          : null,
        fleet: null,
        equipment: null,
      };
    });
  }

  const results: BadgeInventoryItem[] = badges.map((b) => {
    let entityName = 'Unassigned Credential';
    let entitySubtitle = 'Unknown Target';
    let entityId: string | null = null;
    let status = (b.is_active as boolean) ? 'Active' : 'Revoked';

    const p = b.personnel as unknown as {
      id: string;
      first_name: string;
      surname: string;
      emp_code: string;
      status: string;
      job_title?: string;
    } | null;

    const v = b.visitor as unknown as {
      id: string;
      first_name: string;
      surname: string;
      company?: string;
      status: string;
    } | null;

    const f = b.fleet as unknown as {
      id: string;
      fleet_code: string;
      vehicle_type: string;
      registration_number?: string;
      make?: string;
      model?: string;
      status: string;
    } | null;

    const eq = b.equipment as unknown as {
      id: string;
      equip_code: string;
      equipment_type: string;
      status: string;
    } | null;

    if (p) {
      entityName = `${p.first_name} ${p.surname}`;
      entitySubtitle = `${p.emp_code} • ${p.job_title || 'Employee'}`;
      entityId = p.id;
      if (p.status !== 'Active') status = `Personnel ${p.status}`;
    } else if (v) {
      entityName = `${v.first_name} ${v.surname}`;
      entitySubtitle = `Visitor • ${v.company || 'General Visitor'}`;
      entityId = v.id;
      if (v.status !== 'Checked In') status = `Visitor ${v.status}`;
    } else if (f) {
      const isCoal = f.vehicle_type?.toLowerCase().includes('coal');
      entityName = `${f.fleet_code} (${f.make || ''} ${f.model || ''})`.trim();
      entitySubtitle = `${f.vehicle_type} • Reg: ${f.registration_number || 'No Plate'}`;
      entityId = f.id;
      if (f.status !== 'Active') status = `Fleet ${f.status}`;
      if (isCoal) {
        entitySubtitle = `Coal Truck • Reg: ${f.registration_number || 'No Plate'}`;
      }
    } else if (eq) {
      entityName = eq.equip_code;
      entitySubtitle = `${eq.equipment_type} • Machinery`;
      entityId = eq.id;
      if (eq.status !== 'Active') status = `Equipment ${eq.status}`;
    }

    return {
      id: b.id as string,
      qr_code: b.qr_code as string,
      rfid_code: (b.rfid_code as string | null) ?? null,
      entity_type: b.entity_type as string,
      is_active: Boolean(b.is_active),
      issued_at: b.issued_at as string,
      expires_at: (b.expires_at as string | null) ?? null,
      entity_name: entityName,
      entity_subtitle: entitySubtitle,
      entity_id: entityId,
      status,
    };
  });

  if (filterType === 'coal_truck') {
    return results.filter((r) => r.entity_subtitle.toLowerCase().includes('coal'));
  }

  return results;
}

/**
 * Get available entity options for selector dropdowns
 */
export async function getEntityOptions(): Promise<{
  personnel: EntityOption[];
  vehicles: EntityOption[];
  coalTrucks: EntityOption[];
  visitors: EntityOption[];
  equipment: EntityOption[];
}> {
  const { supabase } = await assertAccessControlRole();

  const [pRes, fRes, vRes, eqRes] = await Promise.all([
    supabase
      .from('personnel')
      .select('id, first_name, surname, emp_code, job_title')
      .eq('status', 'Active')
      .limit(50),
    supabase
      .from('fleet')
      .select('id, fleet_code, vehicle_type, registration_number, make, model')
      .eq('status', 'Active')
      .limit(50),
    supabase
      .from('visitors')
      .select('id, first_name, surname, company')
      .eq('status', 'Checked In')
      .limit(50),
    supabase
      .from('equipment')
      .select('id, equip_code, equipment_type')
      .eq('status', 'Active')
      .limit(50),
  ]);

  const personnel: EntityOption[] = (pRes.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.first_name} ${p.surname} (${p.emp_code})`,
    sublabel: p.job_title || 'Employee',
    type: 'personnel',
  }));

  const allVehicles = fRes.data ?? [];
  const coalTrucks: EntityOption[] = allVehicles
    .filter((v) => v.vehicle_type?.toLowerCase().includes('coal'))
    .map((v) => ({
      id: v.id,
      label: `${v.fleet_code} - ${v.make || ''} ${v.model || ''}`.trim(),
      sublabel: `Coal Truck • Reg: ${v.registration_number || 'N/A'}`,
      type: 'coal_truck',
    }));

  const vehicles: EntityOption[] = allVehicles
    .filter((v) => !v.vehicle_type?.toLowerCase().includes('coal'))
    .map((v) => ({
      id: v.id,
      label: `${v.fleet_code} - ${v.make || ''} ${v.model || ''}`.trim(),
      sublabel: `${v.vehicle_type} • Reg: ${v.registration_number || 'N/A'}`,
      type: 'vehicle',
    }));

  let visitorsData = vRes.data;
  if (vRes.error) {
    const fallbackV = await supabase
      .from('visitors')
      .select('id, name, company')
      .eq('status', 'Checked In')
      .limit(50);
    visitorsData = (fallbackV.data ?? []).map((v) => {
      const [firstName = '', ...rest] = (v.name ?? '').split(' ');
      return {
        id: v.id,
        first_name: firstName,
        surname: rest.join(' '),
        company: v.company,
      };
    });
  }

  const visitors: EntityOption[] = (visitorsData ?? []).map((v) => ({
    id: v.id,
    label: `${v.first_name} ${v.surname}`.trim(),
    sublabel: v.company || 'Visitor',
    type: 'visitor',
  }));

  const equipment: EntityOption[] = (eqRes.data ?? []).map((eq) => ({
    id: eq.id,
    label: eq.equip_code,
    sublabel: eq.equipment_type,
    type: 'equipment',
  }));

  return { personnel, vehicles, coalTrucks, visitors, equipment };
}

export interface CreateBadgePayload {
  entityType: CredentialEntityType;
  code?: string;
  rfidCode?: string;
  targetEntityId: string;
  expiresInDays?: number;
}

/**
 * Create and register a new QR/RFID badge credential for any entity type
 */
export async function createBadgeCredential(payload: CreateBadgePayload) {
  const { supabase, employee } = await assertAccessControlRole();
  const { allowed } = await qrMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many badge creation requests. Please wait.');
  }
  const canonicalDeptId =
    (typeof resolveAccessControlDeptId === 'function'
      ? await resolveAccessControlDeptId()
      : null) ?? employee.department_id;

  const entityId = payload.targetEntityId.trim();
  const entityType = payload.entityType;

  if (!entityId) {
    throw new ValidationError('An existing entity must be selected before issuing a badge.');
  }

  // 1. Generate cryptographically random QR code if omitted
  let qrCode = payload.code?.trim();
  if (!qrCode) {
    const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
    switch (entityType) {
      case 'coal_truck':
        qrCode = `TRK-COAL-${randomSuffix}`;
        break;
      case 'vehicle':
        qrCode = `VEH-${randomSuffix}`;
        break;
      case 'visitor':
        qrCode = `VIS-${randomSuffix}`;
        break;
      case 'equipment':
        qrCode = `EQP-${randomSuffix}`;
        break;
      default:
        qrCode = `EMP-${randomSuffix}`;
        break;
    }
  }

  // 2. Compute Expiry
  let expiresAt: string | null = null;
  if (payload.expiresInDays && payload.expiresInDays > 0) {
    expiresAt = new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (entityType === 'visitor') {
    // Visitors default to 24-hour pass
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // 3. Map to database entity_type
  const dbEntityType =
    entityType === 'coal_truck' || entityType === 'vehicle'
      ? 'vehicle'
      : entityType === 'equipment'
        ? 'equipment'
        : entityType === 'visitor'
          ? 'visitor'
          : 'personnel';

  // 4. Insert Badge
  const insertPayload: Record<string, unknown> = {
    qr_code: qrCode,
    rfid_code: payload.rfidCode?.trim() || null,
    entity_type: dbEntityType,
    department_id: canonicalDeptId,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
  };

  if (dbEntityType === 'personnel') insertPayload.personnel_id = entityId;
  else if (dbEntityType === 'visitor') insertPayload.visitor_id = entityId;
  else if (dbEntityType === 'vehicle') insertPayload.fleet_id = entityId;
  else if (dbEntityType === 'equipment') insertPayload.equipment_id = entityId;

  const { data: newBadge, error } = await supabase
    .from('badges')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw new DatabaseError('Failed to save badge to database', {
      table: 'badges',
      cause: error,
    });
  }

  logger.info({
    event: 'qr_badge_credential_created',
    actorId: employee.id,
    badgeId: newBadge.id,
    entityType: dbEntityType,
    entityId,
  });

  await cacheInvalidateTags([
    'table:badges',
    'table:personnel',
    'table:fleet',
    'table:equipment',
    'table:visitors',
    ...(canonicalDeptId ? [`dept:${canonicalDeptId}`] : []),
  ]);
  revalidatePath('/access-control/qr-codes');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/expired');
  revalidatePath('/access-control');
  return { success: true, badge: newBadge };
}

/**
 * Revoke a badge
 */
export async function revokeBadgeCredential(badgeId: string) {
  const { supabase, employee, departmentId } = await assertAccessControlRole();
  const { allowed } = await qrMutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many badge revocation requests. Please wait.');
  }

  const { data: revokedRows, error } = await supabase
    .from('badges')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', badgeId)
    .select('id');

  if (error) {
    throw new DatabaseError('Failed to revoke badge', { table: 'badges', cause: error });
  }
  if (!revokedRows || revokedRows.length === 0) {
    throw new ForbiddenError('Badge revocation blocked or badge not found', {
      resource: 'badges',
      action: 'revoke',
    });
  }

  logger.info({
    event: 'qr_badge_credential_revoked',
    actorId: employee.id,
    badgeId,
  });

  await cacheInvalidateTags(['table:badges', ...(departmentId ? [`dept:${departmentId}`] : [])]);
  revalidatePath('/access-control/qr-codes');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/expired');
  revalidatePath('/access-control');
  return { success: true };
}
