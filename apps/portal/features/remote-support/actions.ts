'use server';

import { randomInt } from 'node:crypto';
import {
  type ClaimRemoteSupportSessionInput,
  type CreateRemoteSupportDeviceInput,
  type CreateRemoteSupportSessionInput,
  claimRemoteSupportSessionSchema,
  createRemoteSupportDeviceSchema,
  createRemoteSupportSessionSchema,
  type EndRemoteSupportSessionInput,
  endRemoteSupportSessionSchema,
  type InitiateTier2ConsentSessionInput,
  initiateTier2ConsentSessionSchema,
  type RemoteSupportAuditEventType,
  type RespondRemoteSupportConsentInput,
  respondRemoteSupportConsentSchema,
  type ToggleCobrowseInput,
  toggleCobrowseSchema,
} from '@repo/contract';
import {
  AuthError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@repo/errors';
import { logger } from '@repo/logger/server';
import {
  FixedWindowStrategy,
  type IStore,
  MemoryStore,
  RateLimiter,
  RedisStore,
  type SimpleRedisClient,
} from '@repo/rate-limiter';
import { getRedisClient } from '@repo/redis';
import {
  getAuthenticatedEmployee,
  type Json,
  type RemoteSupportAuditEventsRow,
  type RemoteSupportDevicesRow,
  type RemoteSupportSessionsRow,
} from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { CACHE_TAGS, updateTags } from '@/lib/server-cache';

const SUPPORT_AGENT_ROLES = new Set(['admin', 'supervisor']);
const ADMIN_ROLE = 'admin';
const SESSION_TTL_MS = 10 * 60_000;
const MIN_CODE_VALUE = 100_000;
const MAX_CODE_EXCLUSIVE = 1_000_000;
const MAX_CODE_GENERATION_ATTEMPTS = 5;
const CLAIM_MAX_FAILED_ATTEMPTS = 5;
const CLAIM_LOCKOUT_WINDOW_MS = 5 * 60_000;
const CLAIM_LOCKOUT_TTL_SECONDS = Math.ceil(CLAIM_LOCKOUT_WINDOW_MS / 1000);
const CLAIM_LOCKOUT_KEY_PREFIX = 'ratelimit:support:claim-lockout:';
const MAX_AUDIT_EVENTS_FETCH = 100;

interface ResilientSupportStore extends IStore {
  delete(key: string): Promise<void>;
}

function createResilientRedisStore(): ResilientSupportStore {
  const fallback = new MemoryStore();

  async function resolveStore(): Promise<IStore> {
    const isUnmockedTestEnv =
      process.env.NODE_ENV === 'test' && !('mock' in (getRedisClient as object));
    if (isUnmockedTestEnv) {
      return fallback;
    }
    try {
      const redisClient = await getRedisClient();
      return new RedisStore(redisClient as unknown as SimpleRedisClient);
    } catch {
      return fallback;
    }
  }

  return {
    async get(key: string): Promise<string | null> {
      const activeStore = await resolveStore();
      try {
        return await activeStore.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      const safeTtl = Math.max(1, ttlSeconds);
      const activeStore = await resolveStore();
      try {
        await activeStore.set(key, value, safeTtl);
      } catch {
        await fallback.set(key, value, safeTtl);
      }
    },
    async delete(key: string): Promise<void> {
      const activeStore = await resolveStore();
      try {
        await activeStore.delete?.(key);
      } catch {
        await fallback.delete(key);
      }
    },
  };
}

const sharedSupportStore = createResilientRedisStore();

const createSessionLimiter = new RateLimiter({
  store: sharedSupportStore,
  strategy: new FixedWindowStrategy(),
  limit: 5,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:support:create:',
});

const claimSessionLimiter = new RateLimiter({
  store: sharedSupportStore,
  strategy: new FixedWindowStrategy(),
  limit: 10,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:support:claim:',
});

const mutationLimiter = new RateLimiter({
  store: sharedSupportStore,
  strategy: new FixedWindowStrategy(),
  limit: 30,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:support:mutate:',
});

type PortalSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface AuditWriteOptions {
  readonly supabase: PortalSupabaseClient;
  readonly sessionId: string;
  readonly actorEmployeeId: string;
  readonly eventType: RemoteSupportAuditEventType;
  readonly metadata?: Record<string, unknown>;
}

interface ClaimAttemptState {
  readonly count: number;
  readonly resetAt: number;
}

function assertStaffRole(role: string): void {
  if (!SUPPORT_AGENT_ROLES.has(role)) {
    throw new ForbiddenError('Only admins or supervisors may perform support desk actions');
  }
}

function assertAdminRole(role: string): void {
  if (role !== ADMIN_ROLE) {
    throw new ForbiddenError('Only admins may manage Tier 2 workstations');
  }
}

async function isClaimLockedOut(employeeId: string): Promise<boolean> {
  const key = `${CLAIM_LOCKOUT_KEY_PREFIX}${employeeId}`;
  const raw = await sharedSupportStore.get(key);
  if (!raw) return false;
  try {
    const entry = JSON.parse(raw) as ClaimAttemptState;
    if (Date.now() > entry.resetAt) {
      await sharedSupportStore.delete(key);
      return false;
    }
    return entry.count >= CLAIM_MAX_FAILED_ATTEMPTS;
  } catch {
    await sharedSupportStore.delete(key);
    return false;
  }
}

async function recordFailedClaim(employeeId: string): Promise<void> {
  const key = `${CLAIM_LOCKOUT_KEY_PREFIX}${employeeId}`;
  const now = Date.now();
  const raw = await sharedSupportStore.get(key);

  let nextState: ClaimAttemptState = {
    count: 1,
    resetAt: now + CLAIM_LOCKOUT_WINDOW_MS,
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ClaimAttemptState;
      if (now <= parsed.resetAt) {
        nextState = {
          count: parsed.count + 1,
          resetAt: parsed.resetAt,
        };
      }
    } catch {
      // Reset malformed lockout payload
    }
  }

  const remainingSeconds = Math.max(
    1,
    Math.min(CLAIM_LOCKOUT_TTL_SECONDS, Math.ceil((nextState.resetAt - now) / 1000))
  );
  await sharedSupportStore.set(key, JSON.stringify(nextState), remainingSeconds);
}

async function clearFailedClaims(employeeId: string): Promise<void> {
  await sharedSupportStore.delete(`${CLAIM_LOCKOUT_KEY_PREFIX}${employeeId}`);
}

async function generateUniqueSixDigitCode(supabase: PortalSupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = String(randomInt(MIN_CODE_VALUE, MAX_CODE_EXCLUSIVE));
    const { data } = await supabase
      .from('remote_support_sessions')
      .select('id')
      .eq('session_code', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }
  throw new ConflictError('Unable to allocate a unique support session code; please retry');
}

async function writeSupportAuditEvent({
  supabase,
  sessionId,
  actorEmployeeId,
  eventType,
  metadata = {},
}: AuditWriteOptions): Promise<void> {
  const { error } = await supabase.from('remote_support_audit_events').insert({
    session_id: sessionId,
    actor_employee_id: actorEmployeeId,
    event_type: eventType,
    metadata: metadata as Json,
  });

  if (error) {
    logger.warn({
      event: 'remote_support_audit_insert_failed',
      sessionId,
      eventType,
      errorMessage: error.message,
    });
  }
}

async function invalidateSupportCaches(): Promise<void> {
  await updateTags([CACHE_TAGS.REMOTE_SUPPORT, CACHE_TAGS.TABLE_REMOTE_SUPPORT_SESSIONS]);
}

/**
 * Fetch the latest immutable remote support audit trail events for manual refresh.
 */
export async function listRemoteSupportAuditEvents(): Promise<{
  readonly success: true;
  readonly events: readonly RemoteSupportAuditEventsRow[];
}> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  assertStaffRole(principal.employee.role);

  const { data, error } = await supabase
    .from('remote_support_audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_AUDIT_EVENTS_FETCH);

  if (error) {
    throw new DatabaseError('Failed to refresh remote support audit events', { cause: error });
  }

  return {
    success: true as const,
    events: (data ?? []) as RemoteSupportAuditEventsRow[],
  };
}

/**
 * Step 1: Any authenticated employee requests remote support and receives a
 * CSPRNG 6-digit consent code valid for 10 minutes.
 */
export async function createRemoteSupportSession(rawInput: CreateRemoteSupportSessionInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;

  const parsed = createRemoteSupportSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid support request');
  }

  const { allowed } = await createSessionLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Too many support session requests. Please wait a minute.');
  }

  const sessionCode = await generateUniqueSixDigitCode(supabase);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { data: sessionRow, error } = await supabase
    .from('remote_support_sessions')
    .insert({
      session_code: sessionCode,
      tier: 'tier1_browser',
      status: 'pending',
      requester_employee_id: employee.id,
      department_slug: parsed.data.departmentSlug ?? null,
      issue_summary: parsed.data.issueSummary,
      client_diagnostics: (parsed.data.clientDiagnostics ?? {}) as Json,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error || !sessionRow) {
    throw new DatabaseError('Failed to create remote support session', {
      cause: error,
      employeeId: employee.id,
    });
  }

  const typedSession = sessionRow as RemoteSupportSessionsRow;
  await writeSupportAuditEvent({
    supabase,
    sessionId: typedSession.id,
    actorEmployeeId: employee.id,
    eventType: 'session_created',
    metadata: {
      tier: typedSession.tier,
      departmentSlug: typedSession.department_slug,
    },
  });

  logger.info({
    event: 'remote_support_session_created',
    sessionId: typedSession.id,
    requesterId: employee.id,
  });

  await invalidateSupportCaches();
  return { success: true as const, session: typedSession };
}

/**
 * Step 2: Admin or supervisor claims a pending session by 6-digit code or ID
 * and dispatches an explicit consent request to the user.
 */
export async function claimRemoteSupportSession(rawInput: ClaimRemoteSupportSessionInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;
  assertStaffRole(employee.role);

  const parsed = claimRemoteSupportSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid claim request');
  }

  if (await isClaimLockedOut(employee.id)) {
    throw new RateLimitError('Too many failed support code attempts. Wait 5 minutes.');
  }

  const { allowed } = await claimSessionLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Claim rate limit exceeded');
  }

  let query = supabase.from('remote_support_sessions').select('*');
  query = parsed.data.sessionId
    ? query.eq('id', parsed.data.sessionId)
    : query.eq('session_code', parsed.data.sessionCode ?? '');

  const { data: existingRow, error: lookupError } = await query.maybeSingle();
  if (lookupError) {
    throw new DatabaseError('Failed to look up support session', { cause: lookupError });
  }
  if (!existingRow) {
    if (parsed.data.sessionCode) {
      await recordFailedClaim(employee.id);
    }
    throw new NotFoundError('Remote support session not found');
  }

  const session = existingRow as RemoteSupportSessionsRow;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new ConflictError('Support session code has expired');
  }
  if (session.status !== 'pending' && session.agent_employee_id !== employee.id) {
    throw new ConflictError('Support session has already been claimed or closed');
  }

  await clearFailedClaims(employee.id);

  const nextStatus = session.status === 'pending' ? 'consent_requested' : session.status;
  const { data: updatedRow, error: updateError } = await supabase
    .from('remote_support_sessions')
    .update({
      agent_employee_id: employee.id,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .select('*')
    .single();

  if (updateError || !updatedRow) {
    throw new DatabaseError('Failed to claim remote support session', {
      cause: updateError,
      sessionId: session.id,
    });
  }

  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: 'session_claimed',
    metadata: { agentRole: employee.role },
  });
  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: 'consent_requested',
    metadata: { tier: session.tier },
  });

  logger.info({
    event: 'remote_support_session_claimed',
    sessionId: session.id,
    agentId: employee.id,
  });

  await invalidateSupportCaches();
  return { success: true as const, session: updatedRow as RemoteSupportSessionsRow };
}

/**
 * Step 3: Only the session requester can approve or reject remote access.
 */
export async function respondToRemoteSupportConsent(rawInput: RespondRemoteSupportConsentInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;

  const parsed = respondRemoteSupportConsentSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid consent response');
  }

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from('remote_support_sessions')
    .select('*')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();

  if (fetchError) {
    throw new DatabaseError('Failed to load remote support session', { cause: fetchError });
  }
  if (!existingRow) {
    throw new NotFoundError('Remote support session not found');
  }

  const session = existingRow as RemoteSupportSessionsRow;
  if (session.requester_employee_id !== employee.id) {
    throw new ForbiddenError('Only the session requester may grant or reject consent');
  }
  if (session.agent_employee_id === employee.id) {
    throw new ForbiddenError('Support engineer cannot approve their own consent request');
  }

  const nowIso = new Date().toISOString();
  const updatePayload = parsed.data.approved
    ? {
        status: 'active' as const,
        consent_granted_at: nowIso,
        started_at: session.started_at ?? nowIso,
        updated_at: nowIso,
      }
    : {
        status: 'rejected' as const,
        ended_at: nowIso,
        end_reason: parsed.data.rejectionReason ?? 'User declined consent',
        updated_at: nowIso,
      };

  const { data: updatedRow, error: updateError } = await supabase
    .from('remote_support_sessions')
    .update(updatePayload)
    .eq('id', session.id)
    .select('*')
    .single();

  if (updateError || !updatedRow) {
    throw new DatabaseError('Failed to record consent decision', {
      cause: updateError,
      sessionId: session.id,
    });
  }

  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: parsed.data.approved ? 'consent_granted' : 'consent_rejected',
    metadata: parsed.data.rejectionReason ? { reason: parsed.data.rejectionReason } : {},
  });

  logger.info({
    event: parsed.data.approved
      ? 'remote_support_consent_granted'
      : 'remote_support_consent_rejected',
    sessionId: session.id,
    requesterId: employee.id,
  });

  await invalidateSupportCaches();
  return { success: true as const, session: updatedRow as RemoteSupportSessionsRow };
}

/**
 * Step 4: Only the requester can grant or revoke Portal Co-Browsing control.
 */
export async function updateCobrowseConsent(rawInput: ToggleCobrowseInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;

  const parsed = toggleCobrowseSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid co-browse payload');
  }

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from('remote_support_sessions')
    .select('*')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();

  if (fetchError) {
    throw new DatabaseError('Failed to load session for co-browse toggle', { cause: fetchError });
  }
  if (!existingRow) {
    throw new NotFoundError('Remote support session not found');
  }

  const session = existingRow as RemoteSupportSessionsRow;
  if (session.requester_employee_id !== employee.id) {
    throw new ForbiddenError('Only the session requester may grant or revoke portal control');
  }
  if (session.status !== 'active') {
    throw new ConflictError('Co-browse control can only be changed on an active session');
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('remote_support_sessions')
    .update({
      cobrowse_enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .select('*')
    .single();

  if (updateError || !updatedRow) {
    throw new DatabaseError('Failed to update co-browse state', { cause: updateError });
  }

  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: parsed.data.enabled ? 'cobrowse_granted' : 'cobrowse_revoked',
  });

  await invalidateSupportCaches();
  return { success: true as const, session: updatedRow as RemoteSupportSessionsRow };
}

/**
 * Step 5: Either requester, assigned agent, or an admin can terminate a session.
 */
export async function endRemoteSupportSession(rawInput: EndRemoteSupportSessionInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;

  const parsed = endRemoteSupportSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid end-session request');
  }

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from('remote_support_sessions')
    .select('*')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();

  if (fetchError) {
    throw new DatabaseError('Failed to load support session', { cause: fetchError });
  }
  if (!existingRow) {
    throw new NotFoundError('Remote support session not found');
  }

  const session = existingRow as RemoteSupportSessionsRow;
  const isParticipant =
    session.requester_employee_id === employee.id ||
    session.agent_employee_id === employee.id ||
    SUPPORT_AGENT_ROLES.has(employee.role) ||
    employee.role === ADMIN_ROLE;

  if (!isParticipant) {
    throw new ForbiddenError('Not authorized to terminate this support session');
  }

  const finalStatus = parsed.data.isRevoked ? 'revoked' : 'ended';
  const nowIso = new Date().toISOString();
  const { data: updatedRow, error: updateError } = await supabase
    .from('remote_support_sessions')
    .update({
      status: finalStatus,
      cobrowse_enabled: false,
      ended_at: nowIso,
      end_reason:
        parsed.data.endReason ?? (parsed.data.isRevoked ? 'Kill switch activated' : 'Closed'),
      resolution_notes: parsed.data.resolutionNotes ?? session.resolution_notes,
      updated_at: nowIso,
    })
    .eq('id', session.id)
    .select('*')
    .single();

  if (updateError || !updatedRow) {
    throw new DatabaseError('Failed to end remote support session', { cause: updateError });
  }

  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: parsed.data.isRevoked ? 'session_revoked' : 'session_ended',
    metadata: {
      endReason: parsed.data.endReason ?? null,
      hasResolutionNotes: Boolean(parsed.data.resolutionNotes),
    },
  });

  logger.info({
    event: 'remote_support_session_closed',
    sessionId: session.id,
    finalStatus,
    actorId: employee.id,
  });

  await invalidateSupportCaches();
  return { success: true as const, session: updatedRow as RemoteSupportSessionsRow };
}

/**
 * Step 6: Initiate a Tier 2 OS Desktop session against a managed workstation.
 */
export async function initiateTier2ConsentSession(rawInput: InitiateTier2ConsentSessionInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;
  assertStaffRole(employee.role);

  const parsed = initiateTier2ConsentSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid Tier 2 session request');
  }

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const { data: deviceRow, error: deviceError } = await supabase
    .from('remote_support_devices')
    .select('*')
    .eq('id', parsed.data.deviceId)
    .eq('is_active', true)
    .maybeSingle();

  if (deviceError) {
    throw new DatabaseError('Failed to load managed workstation', { cause: deviceError });
  }
  if (!deviceRow) {
    throw new NotFoundError('Managed workstation not found or inactive');
  }

  const device = deviceRow as RemoteSupportDevicesRow;
  if (!device.require_user_consent) {
    assertAdminRole(employee.role);
    if (!parsed.data.justificationReason || parsed.data.justificationReason.length < 5) {
      throw new ValidationError('Unattended Tier 2 access requires an audit justification reason');
    }
  }

  const resolvedTargetEmployeeId =
    parsed.data.targetEmployeeId ??
    device.assigned_employee_id ??
    (device.require_user_consent ? null : employee.id);

  if (!resolvedTargetEmployeeId) {
    throw new ValidationError(
      'Workstation has no assigned user. Select a target employee before requesting Tier 2 consent.'
    );
  }
  if (device.require_user_consent && resolvedTargetEmployeeId === employee.id) {
    throw new ForbiddenError('Cannot initiate Tier 2 consent request targeting your own account');
  }
  const targetEmployeeId = resolvedTargetEmployeeId;
  const sessionCode = await generateUniqueSixDigitCode(supabase);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const isUnattendedImmediate = !device.require_user_consent;

  const { data: createdRow, error: insertError } = await supabase
    .from('remote_support_sessions')
    .insert({
      session_code: sessionCode,
      tier: 'tier2_os_desktop',
      status: isUnattendedImmediate ? 'active' : 'consent_requested',
      requester_employee_id: targetEmployeeId,
      agent_employee_id: employee.id,
      device_id: device.id,
      issue_summary: parsed.data.issueSummary,
      consent_granted_at: isUnattendedImmediate ? nowIso : null,
      started_at: isUnattendedImmediate ? nowIso : null,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insertError || !createdRow) {
    throw new DatabaseError('Failed to initiate Tier 2 session', { cause: insertError });
  }

  const session = createdRow as RemoteSupportSessionsRow;
  await writeSupportAuditEvent({
    supabase,
    sessionId: session.id,
    actorEmployeeId: employee.id,
    eventType: isUnattendedImmediate ? 'consent_granted' : 'consent_requested',
    metadata: {
      tier: 'tier2_os_desktop',
      deviceId: device.id,
      hostname: device.hostname,
      unattended: isUnattendedImmediate,
      justificationReason: parsed.data.justificationReason ?? null,
    },
  });

  await invalidateSupportCaches();
  return { success: true as const, session };
}

/**
 * Step 7: Admin-only CRUD for Tier 2 managed workstations (zero stored passwords).
 */
export async function upsertRemoteSupportDevice(rawInput: CreateRemoteSupportDeviceInput) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;
  assertAdminRole(employee.role);

  const parsed = createRemoteSupportDeviceSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid managed device payload');
  }

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const recordPayload = {
    hostname: parsed.data.hostname,
    display_name: parsed.data.displayName,
    site_id: parsed.data.siteId ?? null,
    department_id: parsed.data.departmentId ?? null,
    assigned_employee_id: parsed.data.assignedEmployeeId ?? null,
    device_class: parsed.data.deviceClass,
    protocol: parsed.data.protocol,
    network_host: parsed.data.networkHost,
    network_port: parsed.data.networkPort,
    protocol_options: (parsed.data.protocolOptions ?? {}) as Json,
    require_user_consent: parsed.data.requireUserConsent,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  };

  const query = parsed.data.id
    ? supabase
        .from('remote_support_devices')
        .update(recordPayload)
        .eq('id', parsed.data.id)
        .select('*')
        .single()
    : supabase
        .from('remote_support_devices')
        .insert({ ...recordPayload, created_by: employee.id })
        .select('*')
        .single();

  const { data: savedRow, error } = await query;
  if (error || !savedRow) {
    throw new DatabaseError('Failed to save managed workstation', { cause: error });
  }

  logger.info({
    event: 'remote_support_device_saved',
    deviceId: (savedRow as RemoteSupportDevicesRow).id,
    actorId: employee.id,
  });

  await updateTags([CACHE_TAGS.REMOTE_SUPPORT, CACHE_TAGS.TABLE_REMOTE_SUPPORT_DEVICES]);
  return { success: true as const, device: savedRow as RemoteSupportDevicesRow };
}

export async function deactivateRemoteSupportDevice(options: { readonly deviceId: string }) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  const { employee } = principal;
  assertAdminRole(employee.role);

  const { allowed } = await mutationLimiter.check(employee.id);
  if (!allowed) {
    throw new RateLimitError('Rate limit exceeded');
  }

  const { error } = await supabase
    .from('remote_support_devices')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', options.deviceId);

  if (error) {
    throw new DatabaseError('Failed to deactivate managed workstation', { cause: error });
  }

  await updateTags([CACHE_TAGS.REMOTE_SUPPORT, CACHE_TAGS.TABLE_REMOTE_SUPPORT_DEVICES]);
  return { success: true as const };
}
