'use server';

import { gateDenialSchema, gatePulseSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { cacheInvalidateTags, getRedisClient } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import { triggerTrackedWorkflow } from '@/lib/jobs/workflow-runner';
import { assertAccessControlRole } from './shared';

export interface PerimeterGate {
  id: string;
  name: string;
  gateLocation?: string;
  type: 'boom_barrier' | 'turnstile' | 'weighbridge_rfid' | 'biometric_portal';
  zone: string;
  status: 'ONLINE' | 'INTERLOCK_ARMED' | 'MAINTENANCE' | 'OFFLINE';
  mode: 'Auto-Pulse' | 'BAC Enforced (0.00‰)' | 'EPC Gen2 Long-Range' | 'Dual-Key Auth';
  cycleCountToday: number;
  lastEventTime: string;
  lastEntityPassed: string;
  interlockActive: boolean;
}

const GATE_RATE_LIMIT_WINDOW_MS = 60_000;
const GATE_PULSE_MAX_REQUESTS = 10;
const GATE_DENIAL_MAX_REQUESTS = 20;
const HEARTBEAT_TTL_MS = 5 * 60_000;

function createGateLimiter(limit: number, keyPrefix: string): RateLimiter {
  try {
    const redis = getRedisClient();
    return new RateLimiter({
      store: redis ? new RedisStore(redis as never) : new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit,
      windowMs: GATE_RATE_LIMIT_WINDOW_MS,
      keyPrefix,
    });
  } catch {
    return new RateLimiter({
      store: new MemoryStore(),
      strategy: new FixedWindowStrategy(),
      limit,
      windowMs: GATE_RATE_LIMIT_WINDOW_MS,
      keyPrefix,
    });
  }
}

const GATE_PULSE_LIMITER = createGateLimiter(GATE_PULSE_MAX_REQUESTS, 'ratelimit:gate_pulse:');
const GATE_DENIAL_LIMITER = createGateLimiter(GATE_DENIAL_MAX_REQUESTS, 'ratelimit:gate_denial:');

function mapGateType(rawType: string): PerimeterGate['type'] {
  if (rawType === 'TURNSTILE_ARRAY') return 'turnstile';
  if (rawType === 'WEIGHBRIDGE_BOOM') return 'weighbridge_rfid';
  if (rawType === 'HIGH_SEC_PORTAL') return 'biometric_portal';
  return 'boom_barrier';
}

function mapGateMode(rawType: string, interlockActive: boolean): PerimeterGate['mode'] {
  if (rawType === 'TURNSTILE_ARRAY' && interlockActive) return 'BAC Enforced (0.00‰)';
  if (rawType === 'WEIGHBRIDGE_BOOM') return 'EPC Gen2 Long-Range';
  if (rawType === 'HIGH_SEC_PORTAL') return 'Dual-Key Auth';
  return 'Auto-Pulse';
}

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

interface DbGateRow {
  id: string;
  name: string;
  gate_location: string;
  zone: string;
  gate_type: string;
  interlock_active: boolean;
  is_maintenance: boolean;
  last_heartbeat_at: string | null;
}

export async function getLivePerimeterGates(): Promise<PerimeterGate[]> {
  const { supabase, departmentId } = await assertAccessControlRole();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const gatesRes = await supabase
    .from('perimeter_gates')
    .select(
      'id, name, gate_location, zone, gate_type, interlock_active, is_maintenance, last_heartbeat_at'
    )
    .order('id', { ascending: true })
    .limit(50);

  if (gatesRes.error) {
    throw new DatabaseError('Failed to load perimeter gates telemetry', {
      operation: 'select',
      table: 'perimeter_gates',
      context: { error: gatesRes.error.message },
    });
  }

  const dbGates = (gatesRes.data ?? []) as DbGateRow[];
  if (dbGates.length === 0) {
    return [];
  }

  let logsQuery = supabase
    .from('access_logs')
    .select('gate_location, scanned_at, badge_id')
    .gte('scanned_at', today.toISOString())
    .order('scanned_at', { ascending: false })
    .limit(1000);

  if (departmentId) {
    logsQuery = logsQuery.eq('department_id', departmentId);
  }

  const { data: logs, error: logsError } = await logsQuery;
  if (logsError) {
    throw new DatabaseError('Failed to load today gate cycle counts', {
      operation: 'select',
      table: 'access_logs',
      context: { error: logsError.message },
    });
  }

  const cycleCounts: Record<string, number> = {};
  const lastLogPerGate: Record<string, LastLogEntry> = {};

  for (const log of logs ?? []) {
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

    const badgeById = new Map<
      string,
      | { id: string; entity_type: string; personnel: unknown; visitor: unknown; fleet: unknown }
      | undefined
    >();
    for (const b of badges ?? []) {
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
        lastEntityNames[gateLoc] =
          `${p?.first_name ?? ''} ${p?.surname ?? ''}`.trim() || 'Personnel';
      } else if (badge.entity_type === 'visitor' && badge.visitor) {
        const v = badge.visitor as { first_name?: string; surname?: string } | null;
        lastEntityNames[gateLoc] = `${v?.first_name ?? ''} ${v?.surname ?? ''}`.trim() || 'Visitor';
      } else if (
        (badge.entity_type === 'vehicle' || badge.entity_type === 'fleet') &&
        badge.fleet
      ) {
        const f = badge.fleet as { fleet_code?: string; vehicle_type?: string } | null;
        lastEntityNames[gateLoc] =
          `${f?.vehicle_type ?? 'Vehicle'}: ${f?.fleet_code ?? ''}`.trim() || 'Vehicle';
      } else {
        lastEntityNames[gateLoc] = `Badge ${badge.id.slice(0, 8)}`;
      }
    }
  }

  const nowMs = Date.now();
  return dbGates.map((gate) => {
    const count = cycleCounts[gate.gate_location] ?? 0;
    const lastLog = lastLogPerGate[gate.gate_location];
    const lastEventTime = lastLog ? formatRelativeTime(lastLog.scanned_at) : 'No recent activity';
    const lastEntityPassed = lastLog ? (lastEntityNames[gate.gate_location] ?? '—') : '—';

    const heartbeatMs = gate.last_heartbeat_at ? Date.parse(gate.last_heartbeat_at) : Number.NaN;
    const hasLiveHeartbeat =
      Number.isFinite(heartbeatMs) && nowMs - heartbeatMs <= HEARTBEAT_TTL_MS;

    let status: PerimeterGate['status'];
    if (gate.is_maintenance) {
      status = 'MAINTENANCE';
    } else if (!hasLiveHeartbeat) {
      status = 'OFFLINE';
    } else if (gate.interlock_active) {
      status = 'INTERLOCK_ARMED';
    } else {
      status = 'ONLINE';
    }

    return {
      id: gate.id,
      name: gate.name,
      gateLocation: gate.gate_location,
      type: mapGateType(gate.gate_type),
      zone: gate.zone,
      status,
      mode: mapGateMode(gate.gate_type, gate.interlock_active),
      cycleCountToday: count,
      lastEventTime,
      lastEntityPassed,
      interlockActive: gate.interlock_active,
    };
  });
}

export async function triggerGatePulse(
  gateId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const { supabase, employee, departmentId } = await assertAccessControlRole({
    requireWrite: true,
  });

  const parsed = gatePulseSchema.safeParse({ gateId, reason });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid gate override input');
  }

  const { allowed, limit, remaining, resetTime } = await GATE_PULSE_LIMITER.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded', { limit, remaining, resetTime });
  }

  const relayWebhookUrl = process.env.GATE_RELAY_WEBHOOK_URL?.trim();
  let relayDispatched = false;
  if (relayWebhookUrl) {
    const relayRes = await fetch(relayWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateLocation: parsed.data.gateId,
        reason: parsed.data.reason,
        operatorId: employee.id,
        timestamp: new Date().toISOString(),
      }),
    });
    if (!relayRes.ok) {
      throw new DatabaseError(`Physical gate relay rejected command (${relayRes.status})`, {
        operation: 'relay_dispatch',
        table: 'perimeter_gates',
      });
    }
    relayDispatched = true;
  }

  const { error } = await supabase.from('access_logs').insert({
    gate_location: parsed.data.gateId,
    access_type: 'REMOTE_OVERRIDE',
    direction: 'IN',
    access_granted: true,
    denial_reason: `Manual Gate Override: ${parsed.data.reason} (Authorized by ${employee.role})`,
    department_id: departmentId ?? employee.department_id,
    operator: employee.id,
    device_id: parsed.data.scannerId ?? null,
    alcohol_tested: 'Not Tested',
    scanned_at: new Date().toISOString(),
  });

  if (error) {
    throw new DatabaseError('Failed to record manual gate override', {
      operation: 'insert',
      table: 'access_logs',
      context: { error: error.message },
    });
  }

  logger.info({
    event: 'manual_gate_override_logged',
    actorId: employee.id,
    gateLocation: parsed.data.gateId,
    relayDispatched,
  });

  await cacheInvalidateTags([
    'table:access_logs',
    ...(departmentId ? [`dept:${departmentId}`] : []),
  ]);
  revalidatePath('/access-control');

  return {
    success: true,
    message: relayDispatched
      ? `Gate relay pulsed and override logged for ${parsed.data.gateId}.`
      : `Manual gate override logged for ${parsed.data.gateId} (no PLC relay endpoint configured).`,
  };
}

export async function logGateDenial(
  deptId: string,
  gateId: string,
  badgeId: string,
  reason: string
): Promise<{ success: boolean; message: string; blacklisted?: boolean }> {
  const { supabase, employee } = await assertAccessControlRole({ requireWrite: true });

  const parsed = gateDenialSchema.safeParse({ gateId, badgeId, reason });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid gate denial input');
  }

  const { allowed, limit, remaining, resetTime } = await GATE_DENIAL_LIMITER.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded', { limit, remaining, resetTime });
  }

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
      operator: employee.id,
      alcohol_tested: 'Not Tested',
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
    after(() =>
      triggerTrackedWorkflow(
        jobId,
        '/webhook/soc-alert-blacklist',
        {
          badgeId: parsed.data.badgeId,
          gateId: parsed.data.gateId,
          reason: 'Repeated Denials Threshold Exceeded',
          count: denialsCount,
          departmentId: deptId,
        },
        { awaitCompletion: true }
      )
    );

    const { data: revokedRows, error: revokeErr } = await supabase
      .from('badges')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', parsed.data.badgeId)
      .select('id');

    if (revokeErr) {
      throw new DatabaseError('Failed to blacklist badge after 3 denials', {
        operation: 'update',
        table: 'badges',
        context: { error: revokeErr.message, badgeId: parsed.data.badgeId },
      });
    }
    if (!revokedRows || revokedRows.length === 0) {
      throw new ForbiddenError('Badge blacklist blocked or badge not found', {
        resource: 'badges',
        action: 'blacklist',
      });
    }
    blacklisted = true;
  }

  logger.info({
    event: 'gate_denial_logged',
    actorId: employee.id,
    badgeId: parsed.data.badgeId,
    gateId: parsed.data.gateId,
    blacklisted,
  });

  await cacheInvalidateTags(['table:access_logs', 'table:badges', `dept:${deptId}`]);
  revalidatePath('/access-control');
  revalidatePath('/access-control/badges');
  revalidatePath('/access-control/expired');

  return { success: true, message: 'Gate denial logged.', blacklisted };
}
