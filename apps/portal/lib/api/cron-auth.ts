import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const MIN_CRON_SECRET_LENGTH = 16;
const BEARER_PREFIX = 'Bearer ';
const STATUS_UNAUTHORIZED = 401;
const STATUS_SERVICE_UNAVAILABLE = 503;

function secretsMatchConstantTime(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Verifies that an incoming scheduled job (Vercel Cron / GitHub Actions scheduler)
 * request carries a valid `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Security invariants:
 * 1. Fails closed (503 in production, 401 in non-production) when `CRON_SECRET` is
 *    unset, empty, or shorter than `MIN_CRON_SECRET_LENGTH` — preventing the
 *    `Bearer undefined` interpolation bypass.
 * 2. Uses constant-time comparison (`timingSafeEqual`) to prevent timing side-channels.
 * 3. Never logs or echoes the configured secret or provided token.
 *
 * @returns `null` when authorized, or a `NextResponse` error response when rejected.
 */
export function authorizeCronRequest(req: Request): NextResponse | null {
  const rawSecret = process.env.CRON_SECRET?.trim();
  if (!rawSecret || rawSecret.length < MIN_CRON_SECRET_LENGTH) {
    const status =
      process.env.NODE_ENV === 'production' ? STATUS_SERVICE_UNAVAILABLE : STATUS_UNAUTHORIZED;
    return NextResponse.json(
      { success: false, error: 'Cron authentication secret is not configured.' },
      { status }
    );
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith(BEARER_PREFIX)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: STATUS_UNAUTHORIZED }
    );
  }

  const providedToken = authHeader.slice(BEARER_PREFIX.length).trim();
  if (!providedToken || !secretsMatchConstantTime(providedToken, rawSecret)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: STATUS_UNAUTHORIZED }
    );
  }

  return null;
}
