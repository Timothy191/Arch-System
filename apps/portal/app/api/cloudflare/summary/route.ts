import { cloudflareSummaryResponseSchema } from '@repo/contract';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { getCloudflareClient } from '@/lib/cloudflare/cloudflare-client';

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OK = 200;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

const cloudflareSummaryLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:cloudflare_summary:',
});

/**
 * GET /api/cloudflare/summary
 *
 * Read-only aggregate for the Cloudflare Infrastructure & Edge Security Centre.
 * Every section carries its own connection mode so the UI can render honest
 * state ("Not connected" / "Insufficient permissions" / "Metrics unavailable")
 * without fabricating telemetry.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (!principal?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const { allowed } = await cloudflareSummaryLimiter.check(principal.user.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: HTTP_TOO_MANY_REQUESTS });
  }

  const client = getCloudflareClient();

  const [account, zeroTrust, tunnel, workers, queues, turnstile, aiGateway, r2, securityCentre] =
    await Promise.all([
      client.getAccountStatus(),
      client.getZeroTrustStatus(),
      client.getTunnelStatus(),
      client.getWorkersStatus(),
      client.getQueuesStatus(),
      client.getTurnstileStatus(),
      client.getAiGatewayStatus(),
      client.getR2Status(),
      client.getSecurityCentreStatus(),
    ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    deploymentTarget: process.env.VERCEL ? 'vercel' : 'local',
    account,
    zeroTrust,
    tunnel,
    workers,
    queues,
    turnstile,
    aiGateway,
    r2,
    securityCentre,
  };

  const validated = cloudflareSummaryResponseSchema.parse(payload);

  return NextResponse.json(validated, {
    status: HTTP_OK,
    headers: { 'Cache-Control': 'no-store' },
  });
}
