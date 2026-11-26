import { observabilitySummaryResponseSchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { fetchObservabilitySummary } from '@/lib/observability/observability-clients';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OK = 200;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const summaryLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:observability_summary:',
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (!principal?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  if (principal.employee?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN });
  }

  const { allowed } = await summaryLimiter.check(principal.user.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  const summary = await fetchObservabilitySummary();
  const validated = observabilitySummaryResponseSchema.parse(summary);

  return NextResponse.json(validated, {
    status: HTTP_OK,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
