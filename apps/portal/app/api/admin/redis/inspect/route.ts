import { getRedisClient } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_ADMIN_ROLES = new Set(['admin', 'super_admin', 'executive']);
const SENSITIVE_KEY_PATTERN = /(session|token|secret|password|auth|credential)/i;
const MAX_SCAN_KEYS = 50;

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = String(principal.employee.role ?? '').toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      return NextResponse.json(
        { connected: false, keys: [], inspected: null, error: 'Redis client is disconnected' },
        { status: 503 }
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
    }

    return NextResponse.json({
      connected: true,
      keys,
      inspected,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        connected: false,
        keys: [],
        inspected: null,
        error: err instanceof Error ? err.message : 'Redis inspection failed',
      },
      { status: 500 }
    );
  }
}
