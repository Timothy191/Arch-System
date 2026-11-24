import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getRedisClient } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_ADMIN_ROLES = new Set(['admin']);
const SENSITIVE_KEY_PATTERN = /(session|token|secret|password|auth|credential)/i;
const MAX_SCAN_KEYS = 50;
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const redisInspectLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:admin_redis_inspect:',
});

function formatInspectedValue(key: string, rawValue: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED — sensitive key]';
  }
  if (typeof rawValue !== 'string') {
    return rawValue;
  }
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

export async function GET(req: NextRequest) {
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const role = String(principal.employee.role ?? '').toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN });
  }

  const actorId = principal.user?.id ?? principal.employee.id;
  const rateLimit = await redisInspectLimiter.check(actorId);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_TOO_MANY_REQUESTS });
  }

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

    const scanResult = await redis.scan(0, { MATCH: pattern, COUNT: MAX_SCAN_KEYS });
    const keys = Array.isArray(scanResult.keys) ? scanResult.keys.slice(0, MAX_SCAN_KEYS) : [];

    let inspected: {
      key: string;
      type: string;
      ttlSeconds: number;
      value: unknown;
    } | null = null;

    if (selectedKey) {
      const [keyType, ttlSeconds, rawValue] = await Promise.all([
        redis.type(selectedKey),
        redis.ttl(selectedKey),
        redis.get(selectedKey).catch(() => null),
      ]);

      inspected = {
        key: selectedKey,
        type: keyType || 'unknown',
        ttlSeconds: typeof ttlSeconds === 'number' ? ttlSeconds : -1,
        value: formatInspectedValue(selectedKey, rawValue),
      };

      logger.info({
        event: 'admin_redis_key_inspected',
        actorId,
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
    return NextResponse.json(
      {
        connected: false,
        keys: [],
        inspected: null,
        error: err instanceof Error ? err.message : 'Redis inspection failed',
      },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
