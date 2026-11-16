'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { DatabaseError } from '@/lib/errors/error-classes';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { assertAccessControlRole } from './shared';
import { RateLimiter, type RateLimitResult, MemoryStore, FixedWindowStrategy } from '@repo/rate-limiter';
import { gateDenialSchema, gatePulseSchema, type GatePulseInput } from '@repo/contract';

const GATE_REGISTRY: readonly {
  readonly id: string;
  readonly name: string;
  readonly type: PerimeterGate['type'];
  readonly zone: string;
  readonly mode: PerimeterGate['mode'];
  readonly interlockActive: boolean;
  readonly gateLocation: string;
}[] = [
  {
    id: 'GATE-01-NORTH',
    name: 'Main North Inbound Boom Barrier',
    type: 'boom_barrier',
    zone: 'Perimeter Access Road',
    mode: 'Auto-Pulse',
    interlockActive: false,
    gateLocation: 'Main Gate',
  },
  {
    id: 'GATE-02-SOUTH',
    name: 'Main South Outbound Boom Barrier',
    type: 'boom_barrier',
    zone: 'Perimeter Exit Road',
    mode: 'Auto-Pulse',
    interlockActive: false,
    gateLocation: 'Main Gate Exit',
  },
  {
    id: 'TURN-01-04-PIT',
    name: 'Pit Alpha Turnstiles 1-4 (BAC Interlock)',
    type: 'turnstile',
    zone: 'Pit Extraction Ramp',
    mode: 'BAC Enforced (0.00‰)',
    interlockActive: true,
    gateLocation: 'Turnstile',
  },
  {
    id: 'WEIGH-03-ROM',
    name: 'ROM Weighbridge Long-Range RFID',
    type: 'weighbridge_rfid',
    zone: 'ROM Pad Stockpile',
    mode: 'EPC Gen2 Long-Range',
    interlockActive: false,
    gateLocation: 'ROM Weighbridge',
  },
  {
    id: 'VAULT-05-MAG',
    name: 'Explosives Magazine Biometric Lock',
    type: 'biometric_portal',
    zone: 'Magazine Bunker Area',
    mode: 'Dual-Key Auth',
    interlockActive: true,
    gateLocation: 'Explosives Magazine',
  },
];

function formatRelativeTime(isoTimestamp: string): string {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

interface LastLogEntry {
  scanned_at: string;
  badge_id: string | null;
}

export async function getLivePerimeterGates(): Promise<PerimeterGate[]> {
  const { supabase } = await assertAccessControlRole();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    const { data: logs } = await supabase
      .from('access_logs')
      .select('gate_location, scanned_at, badge_id')
      .gte('scanned_at', today.toISOString())
      .order('scanned_at', { ascending: false });

    const cycleCounts: Record<string, number> = {};
    const lastLogPerGate: Record<string, LastLogEntry> = {};

    for (const log of (logs ?? [])) {
      const loc = log.gate_location;
      cycleCounts[loc] = (cycleCounts[loc] ?? 0) + 1;
      if (!lastLogPerGate[loc] || log.scanned_at > lastLogPerGate[loc].scanned_at) {
        lastLogPerGate[loc] = { scanned_at: log.scanned_at, badge_id: log.badge_id };
      }
    }

    const lastEntityNames: Record<string, string> = {};
    const badgeIds = Object.values(lastLogPerGate)
      .map((entry) => entry.badge_id)
      .filter((id): id is string => id !== null);

    if (badgeIds.length > 0) {
      const { data: badges } = await supabase
        .from('badges')
        .select(
          `
          id,
          entity_type,
          personnel:personnel_id(first_name, surname),
          visitor:visitor_id(first_name, surname),
          fleet:fleet_id(fleet_code, vehicle_type)
        `
        )
        .in('id', badgeIds);

      const badgeById = new Map<string, { id: string; entity_type: string; personnel: unknown; visitor: unknown; fleet: unknown } | undefined>();
      for (const b of (badges ?? [])) {
        badgeById.set(b.id, b);
      }

      for (const [gateLoc, entry] of Object.entries(lastLogPerGate)) {
        if (!entry.badge_id) continue;
        const badge = badgeById.get(entry.badge_id);
        if (!badge) {
          lastEntityNames[gateLoc] = 'Unknown Badge';
          continue;
        }

        if (badge.entity_type === 'personnel' && badge.personnel) {
          const p = badge.personnel as { first_name?: string; surname?: string } | null;
          lastEntityNames[gateLoc] = `${p?.first_name ?? ''} ${p?.surname ?? ''}`.trim() || 'Personnel';
        } else if (badge.entity_type === 'visitor' && badge.visitor) {
          const v = badge.visitor as { first_name?: string; surname?: string } | null;
          lastEntityNames[gateLoc] = `${v?.first_name ?? ''} ${v?.surname ?? ''}`.trim() || 'Visitor';
        } else if (badge.entity_type === 'vehicle' && badge.fleet) {
          const f = badge.fleet as { fleet_code?: string; vehicle_type?: string } | null;
          lastEntityNames[gateLoc] = `${f?.vehicle_type ?? 'Vehicle'}: ${f?.fleet_code ?? ''}`.trim() || 'Vehicle';
        } else {
          lastEntityNames[gateLoc] = `Badge ${badge.id.slice(0, 8)}`;
        }
      }
    }

    return GATE_REGISTRY.map((gate) => {
      const count = cycleCounts[gate.gateLocation] ?? 0;
      const lastLog = lastLogPerGate[gate.gateLocation];
      const lastEventTime = lastLog ? formatRelativeTime(lastLog.scanned_at) : 'No recent activity';
      const lastEntityPassed = lastLog ? (lastEntityNames[gate.gateLocation] ?? '—') : '—';

      let status: PerimeterGate['status'];
      if (gate.interlockActive) {
        status = 'INTERLOCK_ARMED';
      } else if (count > 0) {
        status = 'ONLINE';
      } else {
        status = 'ONLINE';
      }

      return {
        id: gate.id,
        name: gate.name,
        type: gate.type,
        zone: gate.zone,
        status,
        mode: gate.mode,
        cycleCountToday: count,
        lastEventTime,
        lastEntityPassed,
        interlockActive: gate.interlockActive,
      };
    });
  } catch {
    return GATE_REGISTRY.map((gate) => ({
      id: gate.id,
      name: gate.name,
      type: gate.type,
      zone: gate.zone,
      status: gate.interlockActive ? ('INTERLOCK_ARMED' as const) : ('ONLINE' as const),
      mode: gate.mode,
      cycleCountToday: 0,
      lastEventTime: 'Unavailable',
      lastEntityPassed: '—',
      interlockActive: gate.interlockActive,
    }));
  }
}

export async function triggerGatePulse(
  gateId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  // Rate limiting check
  const { allowed, limit, remaining, resetTime } = await GATE_PULSE_LIMITER.check(
    gateId
  );
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded', { limit, remaining, resetTime });
  }

  const parsed = gatePulseSchema.safeParse({ gateId, reason });
  if (!parsed.success) {
    throw new DatabaseError('Invalid gate pulse input', {
      context: { issues: parsed.error.issues },
    });
  }

  const { supabase, employee } = await assertAccessControlRole({ requireWrite: true });

  const { error } = await supabase.from('access_logs').insert({
    gate_location: gateId,
    access_type: 'REMOTE_OVERRIDE',
    direction: 'IN',
    access_granted: true,
    denial_reason: `Operator Pulse: ${parsed.data.reason} (Authorized by ${employee?.role ?? 'admin'})`,
    department_id: employee?.department_id,
    operator: employee?.user?.id ?? 'system',
    device_id: parsed.data.scannerId ?? null,
    scanned_at: new Date().toISOString(),
  });

  if (error) {
    throw new DatabaseError('Failed to record gate override pulse', {
      operation: 'insert',
      table: 'access_logs',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:access_logs']);
  revalidatePath('/access-control');
  return { success: true, message: `Gate ${gateId} pulsed successfully. Audit event recorded.` };
}

export async function logGateDenial(
  deptId: string,
  gateId: string,
  badgeId: string,
  reason: string
): Promise<{ success: boolean; message: string; blacklisted?: boolean }> {
  // Rate limiting check
  const { allowed, limit, remaining, resetTime } = await GATE_DENIAL_LIMITER.check(
    gateId
  );
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded', { limit, remaining, resetTime });
  }

  const parsed = gateDenialSchema.safeParse({ gateId, badgeId, reason });
  if (!parsed.success) {
    throw new DatabaseError('Invalid gate denial input', {
      context: { issues: parsed.error.issues },
    });
  }

  const { supabase } = await assertAccessControlRole({ requireWrite: true });

  const { data: log, error } = await supabase
    .from('access_logs')
    .insert({
      gate_location: parsed.data.gateId,
      access_type: 'CARD_SCAN',
      direction: 'IN',
      access_granted: false,
      denial_reason: parsed.data.reason,
      department_id: deptId,
      badge_id: parsed.data.badgeId,
    })
    .select('id')
    .single();

  if (error || !log) {
    throw new DatabaseError('Failed to record gate denial', {
      operation: 'insert',
      table: 'access_logs',
      context: { error: error?.message },
    });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { count: denialsCount } = await supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('badge_id', parsed.data.badgeId)
    .eq('access_granted', false)
    .gte('scanned_at', today.toISOString());

  let blacklisted = false;

  if (denialsCount && denialsCount >= 3) {
    const jobId = `SOC-ALERT-${log.id}`;
    await triggerTrackedWorkflow(jobId, '/webhook/soc-alert-blacklist', {
      badgeId: parsed.data.badgeId,
      gateId: parsed.data.gateId,
      reason: 'Repeated Denials Threshold Exceeded',
      count: denialsCount,
      departmentId: deptId,
    });

    await supabase
      .from('badges')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', parsed.data.badgeId);
    blacklisted = true;
  }

  await cacheInvalidateTags(['table:access_logs', 'table:badges', `dept:${deptId}`]);
  revalidatePath('/access-control');

  return { success: true, message: 'Gate denial logged.', blacklisted };
}
