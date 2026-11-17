import { turnstileVerifyInputSchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { getCloudflareClient } from '@/lib/cloudflare/cloudflare-client';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_OK = 200;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

const turnstileVerifyLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:turnstile_verify:',
});

/**
 * POST /api/cloudflare/turnstile/verify
 *
 * Server-side Turnstile token verification. Fail-closed: when the secret is
 * unconfigured or the API is unreachable, the response is `verified: false`
 * so the caller can deny the action rather than silently pass.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (!principal?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const { allowed } = await turnstileVerifyLimiter.check(principal.user.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_FORBIDDEN });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: HTTP_BAD_REQUEST });
  }

  const parsed = turnstileVerifyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const client = getCloudflareClient();
  const result = await client.verifyTurnstileToken({
    token: parsed.data.token,
    remoteIp: parsed.data.remoteIp,
  });

  // Never include the secret in the response; only booleans + error code.
  return NextResponse.json(
    {
      success: result.success,
      verified: result.verified,
      errorCode: result.errorCode,
      detail: result.detail,
    },
    {
      status: HTTP_OK,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
