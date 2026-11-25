import { createHmac } from 'node:crypto';
import {
  type IceServerConfig,
  type IceServersResponse,
  iceServersRequestSchema,
} from '@repo/contract';
import { logger } from '@repo/logger/server';
import { getAuthenticatedEmployee, type RemoteSupportSessionsRow } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';

const DEFAULT_TURN_TTL_SECONDS = 3600;
const STUN_FALLBACK_URL = 'stun:stun.cloudflare.com:3478';
const SUPPORT_STAFF_ROLES = new Set(['admin', 'supervisor']);

async function fetchCloudflareTurnServers(
  tokenId: string,
  apiToken: string
): Promise<IceServerConfig[] | null> {
  const endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
    tokenId
  )}/credentials/generate-ice-servers`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: DEFAULT_TURN_TTL_SECONDS }),
  });

  if (!response.ok) {
    logger.warn({
      event: 'cloudflare_turn_mint_failed',
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json()) as { iceServers?: IceServerConfig[] };
  return Array.isArray(payload.iceServers) && payload.iceServers.length > 0
    ? payload.iceServers
    : null;
}

function buildCoturnHmacServers(options: {
  readonly turnUrlsRaw: string;
  readonly sharedSecret: string;
  readonly sessionId: string;
}): IceServerConfig[] {
  const urls = options.turnUrlsRaw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const expiryEpoch = Math.floor(Date.now() / 1000) + DEFAULT_TURN_TTL_SECONDS;
  const username = `${expiryEpoch}:${options.sessionId}`;
  const credential = createHmac('sha1', options.sharedSecret).update(username).digest('base64');

  return [
    { urls: STUN_FALLBACK_URL },
    {
      urls,
      username,
      credential,
    },
  ];
}

async function resolveIceServers(sessionId: string): Promise<IceServersResponse> {
  const cfTokenId = process.env.CLOUDFLARE_CALLS_TURN_TOKEN_ID;
  const cfApiToken = process.env.CLOUDFLARE_CALLS_TURN_API_TOKEN;

  if (cfTokenId && cfApiToken) {
    try {
      const cfServers = await fetchCloudflareTurnServers(cfTokenId, cfApiToken);
      if (cfServers) {
        return {
          iceServers: cfServers,
          relayAvailable: true,
          provider: 'cloudflare_calls',
          ttlSeconds: DEFAULT_TURN_TTL_SECONDS,
        };
      }
    } catch (err) {
      logger.warn({
        event: 'cloudflare_turn_request_error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const turnUrlsRaw = process.env.TURN_URLS;
  const turnSecret = process.env.TURN_SHARED_SECRET;
  if (turnUrlsRaw && turnSecret) {
    return {
      iceServers: buildCoturnHmacServers({
        turnUrlsRaw,
        sharedSecret: turnSecret,
        sessionId,
      }),
      relayAvailable: true,
      provider: 'coturn_hmac',
      ttlSeconds: DEFAULT_TURN_TTL_SECONDS,
    };
  }

  return {
    iceServers: [{ urls: STUN_FALLBACK_URL }],
    relayAvailable: false,
    provider: 'stun_fallback',
    ttlSeconds: DEFAULT_TURN_TTL_SECONDS,
  };
}

async function handleIceServersPost(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const validated = await validateBody(request, iceServersRequestSchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { data: sessionRow, error } = await supabase
    .from('remote_support_sessions')
    .select('id, status, requester_employee_id, agent_employee_id')
    .eq('id', validated.data.sessionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to verify support session' }, { status: 500 });
  }
  if (!sessionRow) {
    return NextResponse.json({ error: 'Support session not found' }, { status: 404 });
  }

  const session = sessionRow as Pick<
    RemoteSupportSessionsRow,
    'id' | 'status' | 'requester_employee_id' | 'agent_employee_id'
  >;

  const isParticipant =
    session.requester_employee_id === principal.employee.id ||
    session.agent_employee_id === principal.employee.id ||
    SUPPORT_STAFF_ROLES.has(principal.employee.role);

  if (!isParticipant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (session.status === 'ended' || session.status === 'rejected' || session.status === 'revoked') {
    return NextResponse.json({ error: 'Support session is closed' }, { status: 409 });
  }

  const responsePayload = await resolveIceServers(session.id);
  return NextResponse.json(responsePayload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, () => withBodyLimit(request, () => handleIceServersPost(request)));
}
