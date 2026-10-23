/**
 * Server-side session state and privilege fencing.
 *
 * Authentication itself stays with Supabase (JWT in an httpOnly cookie); this
 * module owns the *authorization* state that the app cached ad hoc in Redis:
 * the employee row used for RBAC in the request proxy and in every server
 * action.
 *
 * The problem it fixes: `arch:auth:employee:{userId}` was written by two
 * different code paths with two different shapes, lived for a full hour, and
 * was never deleted on logout or when an admin changed a role. A demoted
 * operator therefore kept the routes and permissions of their old role for up
 * to 60 minutes per instance.
 *
 * The mechanism: every session record is stamped with the user's privilege
 * version. Revocation is a single `INCR` on the version key, which instantly
 * invalidates every stored copy of the record — no SCAN, no dependency on the
 * Pub/Sub broadcast that serverless transports cannot deliver.
 */

import { incrementCounter } from './analytics';
import { cacheGet, cacheSet, memoryDelete } from './cache';
import { getRedisClient } from './client';
import { asNumber, sendSafe } from './raw';
import { CACHE_TTL_REGISTRY, CacheCategory } from './registry';

const SESSION_TTL_SECONDS = CACHE_TTL_REGISTRY[CacheCategory.AUTH].l2Seconds;
const VERSION_TTL_SECONDS = 86_400;

/** Shape shared by the request proxy, server actions, and API routes. */
export interface EmployeeRecord {
  id: string;
  role: string;
  department_id: string;
  accessible_departments: string[];
}

export interface StoredSession extends EmployeeRecord {
  userId: string;
  /** Privilege version at write time; a mismatch means the record is stale. */
  privilegeVersion: number;
  issuedAt: number;
  lastSeenAt: number;
}

export interface SessionOptions {
  /** Distinguishes multiple concurrent sessions once the IdP exposes them. */
  sessionId?: string;
}

export function employeeCacheKey(userId: string): string {
  return `arch:auth:employee:${userId}`;
}

export function privilegeVersionKey(userId: string): string {
  return `arch:auth:privilege:${userId}`;
}

export function sessionKey(userId: string, options?: SessionOptions): string {
  if (!options?.sessionId || options.sessionId === 'default') {
    return employeeCacheKey(userId);
  }
  return `arch:auth:employee:${userId}:session:${options.sessionId}`;
}

/**
 * Current privilege version. 0 means "never bumped", which every pre-existing
 * record is allowed to match so the rollout cannot lock anyone out.
 */
export async function getPrivilegeVersion(userId: string): Promise<number> {
  const redis = await getRedisClient();
  const raw = await sendSafe(redis, ['GET', privilegeVersionKey(userId)]);
  return asNumber(raw);
}

/**
 * Invalidate every cached authorization record for a user.
 *
 * Call this whenever role, department, or access list changes — or on logout.
 * The version bump is the durable part; deleting the key is an optimization.
 */
export async function bumpPrivilegeVersion(
  userId: string,
  options?: { deleteSessionKeys?: boolean }
): Promise<number> {
  const redis = await getRedisClient();
  const version = asNumber(await sendSafe(redis, ['INCR', privilegeVersionKey(userId)]));

  if (options?.deleteSessionKeys !== false) {
    await Promise.all([
      sendSafe(redis, ['DEL', employeeCacheKey(userId)]),
      sendSafe(redis, ['EXPIRE', privilegeVersionKey(userId), VERSION_TTL_SECONDS]),
    ]);
  }

  // This instance stops serving the old record immediately.
  memoryDelete(employeeCacheKey(userId));
  return version;
}

/**
 * Read the cached session, verifying it was written under the current privilege
 * version. The two reads are issued together so a serverless transport pipelines
 * them into one round-trip.
 */
export async function readSession(
  userId: string,
  options?: SessionOptions
): Promise<EmployeeRecord | null> {
  const [version, stored] = await Promise.all([
    getPrivilegeVersion(userId),
    cacheGet<StoredSession>(sessionKey(userId, options)),
  ]);

  if (!stored) return null;

  // Records written before fencing existed carry no version; accept them once
  // and let the next write replace them with a stamped copy.
  if (typeof stored.privilegeVersion !== 'number') {
    return stored.id ? toEmployeeRecord(stored) : null;
  }

  if (stored.privilegeVersion !== version) return null;
  return toEmployeeRecord(stored);
}

function toEmployeeRecord(stored: StoredSession): EmployeeRecord {
  return {
    id: stored.id,
    role: stored.role,
    department_id: stored.department_id,
    accessible_departments: Array.isArray(stored.accessible_departments)
      ? stored.accessible_departments
      : [],
  };
}

/**
 * Store the authoritative employee row as the user's session record, stamped
 * with the privilege version that was current when it was read.
 */
export interface WriteSessionInput extends SessionOptions {
  userId: string;
  employee: EmployeeRecord;
}

export async function writeSession(input: WriteSessionInput): Promise<void> {
  const { userId, employee } = input;
  const now = Date.now();
  const privilegeVersion = await getPrivilegeVersion(userId);

  const record: StoredSession = {
    ...employee,
    userId,
    privilegeVersion,
    issuedAt: now,
    lastSeenAt: now,
  };

  await cacheSet(sessionKey(userId, input), record, SESSION_TTL_SECONDS);
}

/**
 * Sliding expiry: keep an actively used session alive without re-reading the
 * database. Writes are throttled per process so a busy page does not issue a
 * Redis command on every navigation.
 */
const LAST_TOUCH = new Map<string, number>();
const TOUCH_INTERVAL_MS = 60_000;
/** Bound the throttle map so a long-lived server cannot grow it without limit. */
const MAX_TOUCHED_SESSIONS = 5_000;

export async function touchSession(
  userId: string,
  options?: SessionOptions & { force?: boolean }
): Promise<boolean> {
  const key = sessionKey(userId, options);
  const now = Date.now();
  const previous = LAST_TOUCH.get(key) ?? 0;

  if (!options?.force && now - previous < TOUCH_INTERVAL_MS) return false;
  LAST_TOUCH.set(key, now);
  if (LAST_TOUCH.size > MAX_TOUCHED_SESSIONS) LAST_TOUCH.clear();

  const redis = await getRedisClient();
  // GETEX refreshes the TTL and returns the value only when the key is live.
  const extended = await sendSafe(redis, ['GETEX', key, 'EX', SESSION_TTL_SECONDS]);
  if (extended !== null && extended !== undefined) return true;

  return asNumber(await sendSafe(redis, ['EXPIRE', key, SESSION_TTL_SECONDS])) === 1;
}

/**
 * End a session: drop the cached record and fence every other copy by bumping
 * the privilege version. Called on logout and whenever an employee's role,
 * department, or access list changes.
 */
export async function revokeSession(
  userId: string,
  options?: { reason?: 'logout' | 'role-change' | 'deactivated' | 'manual' }
): Promise<void> {
  await bumpPrivilegeVersion(userId);
  await incrementCounter('auth.session.revoked', { dimension: options?.reason ?? 'manual' });
}

/** Redis reports -2 when the key does not exist. */
const SESSION_ABSENT = -2;

/**
 * How long a cached session has left. Negative values mean the record is gone
 * (-2 absent, -1 no expiry) so callers can decide whether to re-read the DB.
 */
export async function sessionTtl(userId: string, options?: SessionOptions): Promise<number> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['TTL', sessionKey(userId, options)]), SESSION_ABSENT);
}
