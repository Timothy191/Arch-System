import { turnstileVerificationResultSchema, turnstileVerifyInputSchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { getClientIp, withRateLimit } from '@/lib/api/rate-limit-middleware';
import { getCloudflareClient } from '@/lib/cloudflare/cloudflare-client';

const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OK = 200;
const MAX_TURNSTILE_BODY_BYTES = 8_192;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

const turnstileVerifyLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:turnstile_verify:',
});

async function resolveRateLimitSubject(request: Request): Promise<string> {
  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (principal?.user?.id) {
      return `user:${principal.user.id}`;
    }
  } catch {
    // Unauthenticated pre-auth flows (e.g. /login) have no session; fall back to client IP.
  }
  return `ip:${getClientIp(request)}`;
}

async function handleTurnstileVerify(request: Request): Promise<NextResponse> {
  const rateLimitSubject = await resolveRateLimitSubject(request);
  const { allowed, retryAfter } = await turnstileVerifyLimiter.check(rateLimitSubject);
  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: 'Rate limit exceeded',
      },
      {
        status: HTTP_TOO_MANY_REQUESTS,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(retryAfter ?? 60),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: 'Invalid JSON body',
      },
      { status: HTTP_BAD_REQUEST, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = turnstileVerifyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input',
      },
      { status: HTTP_BAD_REQUEST, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const detectedIp = getClientIp(request);
  const effectiveRemoteIp =
    parsed.data.remoteIp ?? (IPV4_REGEX.test(detectedIp) ? detectedIp : undefined);

  try {
    const client = getCloudflareClient();
    const result = await client.verifyTurnstileToken({
      token: parsed.data.token,
      remoteIp: effectiveRemoteIp,
    });

    const isVerified = Boolean(result.success && result.verified);
    const failClosedPayload = turnstileVerificationResultSchema.parse({
      success: isVerified,
      verified: isVerified,
      errorCode: result.errorCode ?? (isVerified ? null : 'VERIFICATION_FAILED'),
      detail: result.detail,
    });

    return NextResponse.json(failClosedPayload, {
      status: HTTP_OK,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    const fallbackPayload = turnstileVerificationResultSchema.parse({
      success: false,
      verified: false,
      errorCode: 'VERIFICATION_UNAVAILABLE',
      detail: 'Turnstile verification failed closed due to an internal error',
    });

    return NextResponse.json(fallbackPayload, {
      status: HTTP_OK,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

/**
 * POST /api/cloudflare/turnstile/verify
 *
 * Server-side Turnstile token verification accessible to pre-auth challenge flows
 * (e.g. Portal Login) and authenticated callers. Enforces distributed + local rate
 * limiting and fails closed (`success: false, verified: false`) whenever the secret
 * is unconfigured, Cloudflare is unreachable, or verification fails.
 */
export async function POST(request: Request) {
  return withRateLimit(
    request,
    () =>
      withBodyLimit(request, () => handleTurnstileVerify(request), {
        maxSize: MAX_TURNSTILE_BODY_BYTES,
      }),
    { customLimit: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: RATE_LIMIT_MAX } }
  );
}
