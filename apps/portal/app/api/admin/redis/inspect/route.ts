import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getRedisClient } from '@repo/redis';
import {
  asFieldMap,
  asScoredMembers,
  asStringArray,
  parseStreamReply,
  type SendCapable,
  sendSafe,
} from '@repo/redis/raw';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_ADMIN_ROLES = new Set(['admin']);
const SENSITIVE_KEY_PATTERN = /(session|token|secret|password|auth|credential)/i;
const PROTECTED_KEY_PATTERN = /^(session:|auth:|ratelimit:|lock:|arch:lock:|__)/i;
const MAX_SCAN_KEYS = 50;
const MAX_COLLECTION_ITEMS = 100;
const MAX_STREAM_ENTRIES = 50;
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const REDACTED_VALUE = '[REDACTED — sensitive key]';

const redisInspectLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:admin_redis_inspect:',
});

interface AuthenticatedAdmin {
  readonly actorId: string;
}

type AuthCheckResult =
  | { readonly ok: true; readonly admin: AuthenticatedAdmin }
  | { readonly ok: false; readonly response: NextResponse };

async function authorizeAdminRequest(): Promise<AuthCheckResult> {
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED }),
    };
  }

  const role = String(principal.employee.role ?? '').toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN }),
    };
  }

  const actorId = principal.user?.id ?? principal.employee.id;
  const rateLimit = await redisInspectLimiter.check(actorId);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: HTTP_TOO_MANY_REQUESTS }
      ),
    };
  }

  return { ok: true, admin: { actorId } };
}

function parseStringPayload(rawText: string | null): unknown {
  if (rawText === null) return null;
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

interface InspectableRedisClient extends SendCapable {
  readonly isOpen?: boolean;
  readonly get?: (key: string) => Promise<string | null>;
  readonly hGetAll?: (key: string) => Promise<Record<string, string>>;
  readonly lRange?: (key: string, start: number, stop: number) => Promise<string[]>;
  readonly sMembers?: (key: string) => Promise<string[]>;
  readonly zRangeWithScores?: (
    key: string,
    min: number,
    max: number
  ) => Promise<Array<{ value?: string; member?: string; score: number }>>;
  readonly xRange?: (
    key: string,
    start: string,
    end: string,
    options?: { COUNT?: number }
  ) => Promise<unknown>;
}

async function readKeyByType(options: {
  readonly redis: InspectableRedisClient;
  readonly key: string;
  readonly keyType: string;
}): Promise<unknown> {
  const { redis, key, keyType } = options;
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  const normalizedType = keyType.toLowerCase();
  if (normalizedType === 'string') {
    const rawString =
      typeof redis.get === 'function' ? await redis.get(key).catch(() => null) : null;
    return parseStringPayload(rawString);
  }

  if (normalizedType === 'hash') {
    if (typeof redis.hGetAll === 'function') {
      return redis.hGetAll(key).catch(() => ({}));
    }
    const rawHash = await sendSafe(redis, ['HGETALL', key]);
    return asFieldMap(rawHash);
  }

  if (normalizedType === 'list') {
    const stopIndex = MAX_COLLECTION_ITEMS - 1;
    if (typeof redis.lRange === 'function') {
      return redis.lRange(key, 0, stopIndex).catch(() => []);
    }
    const rawList = await sendSafe(redis, ['LRANGE', key, 0, stopIndex]);
    return asStringArray(rawList);
  }

  if (normalizedType === 'set') {
    if (typeof redis.sMembers === 'function') {
      return redis.sMembers(key).catch(() => []);
    }
    const rawSet = await sendSafe(redis, ['SMEMBERS', key]);
    return asStringArray(rawSet);
  }

  if (normalizedType === 'zset') {
    const stopIndex = MAX_COLLECTION_ITEMS - 1;
    if (typeof redis.zRangeWithScores === 'function') {
      const scored = await redis.zRangeWithScores(key, 0, stopIndex).catch(() => []);
      return asScoredMembers(scored);
    }
    const rawZset = await sendSafe(redis, ['ZRANGE', key, 0, stopIndex, 'WITHSCORES']);
    return asScoredMembers(rawZset);
  }

  if (normalizedType === 'stream') {
    if (typeof redis.xRange === 'function') {
      const entries = await redis
        .xRange(key, '-', '+', { COUNT: MAX_STREAM_ENTRIES })
        .catch(() => []);
      const parsed = parseStreamReply(entries);
      return parsed[0]?.entries ?? entries;
    }
    const rawStream = await sendSafe(redis, ['XRANGE', key, '-', '+', 'COUNT', MAX_STREAM_ENTRIES]);
    return parseStreamReply(rawStream)[0]?.entries ?? [];
  }

  return null;
}

function isProtectedRedisKey(key: string): boolean {
  return PROTECTED_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(key);
}

async function resolveTargetKeyFromDeleteRequest(req: NextRequest): Promise<string | null> {
  const queryKey = req.nextUrl.searchParams.get('key')?.trim();
  if (queryKey) return queryKey;

  if (typeof req.json !== 'function') return null;
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  if (body && typeof body.key === 'string' && body.key.trim().length > 0) {
    return body.key.trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authResult = await authorizeAdminRequest();
  if (!authResult.ok) return authResult.response;

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      return NextResponse.json(
        { connected: false, keys: [], inspected: null, error: 'Redis client is disconnected' },
        { status: HTTP_SERVICE_UNAVAILABLE }
      );
    }

    const pattern = req.nextUrl.searchParams.get('pattern')?.trim() || '*';
    const selectedKey = req.nextUrl.searchParams.get('key')?.trim() || null;

    const MAX_SCAN_ITERATIONS = 15;
    const collectedKeys = new Set<string>();
    let cursor = 0;
    let iterations = 0;
    do {
      const scanResult = await redis.scan(cursor, { MATCH: pattern, COUNT: MAX_SCAN_KEYS });
      const batch = Array.isArray(scanResult.keys) ? scanResult.keys : [];
      for (const k of batch) {
        collectedKeys.add(k);
        if (collectedKeys.size >= MAX_SCAN_KEYS) break;
      }
      cursor = Number(scanResult.cursor ?? 0);
      iterations += 1;
    } while (
      cursor !== 0 &&
      collectedKeys.size < MAX_SCAN_KEYS &&
      iterations < MAX_SCAN_ITERATIONS
    );
    const keys = Array.from(collectedKeys).slice(0, MAX_SCAN_KEYS);

    let inspected: {
      key: string;
      type: string;
      ttlSeconds: number;
      value: unknown;
    } | null = null;

    if (selectedKey) {
      const [rawKeyType, ttlSeconds] = await Promise.all([
        redis.type(selectedKey),
        redis.ttl(selectedKey),
      ]);
      const resolvedType = rawKeyType || 'unknown';
      const inspectedValue = await readKeyByType({
        redis: redis as unknown as InspectableRedisClient,
        key: selectedKey,
        keyType: resolvedType,
      });

      inspected = {
        key: selectedKey,
        type: resolvedType,
        ttlSeconds: typeof ttlSeconds === 'number' ? ttlSeconds : -1,
        value: inspectedValue,
      };

      logger.info({
        event: 'admin_redis_key_inspected',
        actorId: authResult.admin.actorId,
        key: selectedKey,
        keyType: inspected.type,
      });
    }

    return NextResponse.json(
      {
        connected: true,
        keys,
        inspected,
      },
      { status: HTTP_OK }
    );
  } catch (err: unknown) {
    logger.error({
      event: 'admin_redis_inspect_failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        connected: false,
        keys: [],
        inspected: null,
        error: 'Redis inspection failed',
      },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await authorizeAdminRequest();
  if (!authResult.ok) return authResult.response;

  const targetKey = await resolveTargetKeyFromDeleteRequest(req);
  if (!targetKey) {
    return NextResponse.json({ error: 'Key parameter is required' }, { status: HTTP_BAD_REQUEST });
  }

  if (isProtectedRedisKey(targetKey)) {
    logger.warn({
      event: 'admin_redis_protected_key_delete_blocked',
      actorId: authResult.admin.actorId,
      key: targetKey,
    });
    return NextResponse.json(
      { error: `Key "${targetKey}" is protected and cannot be deleted` },
      { status: HTTP_FORBIDDEN }
    );
  }

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      return NextResponse.json(
        { deleted: false, error: 'Redis client is disconnected' },
        { status: HTTP_SERVICE_UNAVAILABLE }
      );
    }

    const deletedCount = await redis.del(targetKey);

    logger.info({
      event: 'admin_redis_key_deleted',
      actorId: authResult.admin.actorId,
      key: targetKey,
      deletedCount,
    });

    return NextResponse.json(
      {
        success: true,
        key: targetKey,
        deleted: deletedCount > 0,
        deletedCount,
      },
      { status: HTTP_OK }
    );
  } catch (err: unknown) {
    logger.error({
      event: 'admin_redis_delete_failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        deleted: false,
        error: 'Redis key deletion failed',
      },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
