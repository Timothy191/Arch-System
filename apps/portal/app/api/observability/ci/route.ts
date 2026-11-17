import { observabilityCiResponseSchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { fetchObservabilityCi } from '@/lib/observability/observability-clients';

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OK = 200;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const ciLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:observability_ci:',
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (!principal?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const { allowed } = await ciLimiter.check(principal.user.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  const ciPayload = await fetchObservabilityCi();
  const validated = observabilityCiResponseSchema.parse(ciPayload);

  return NextResponse.json(validated, {
    status: HTTP_OK,
    headers: { 'Cache-Control': 'no-store' },
  });
}
