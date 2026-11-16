import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

interface AuthorizeOptions {
  readonly req: Request;
  readonly secret: string | null;
  readonly label: string;
}

function configuredSecrets(names: readonly string[]): readonly string[] {
  return names
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value && value.trim().length > 0));
}

function configuredSecret(names: readonly string[]): string | null {
  return configuredSecrets(names)[0] ?? null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function matchesAnySecret(provided: string, expectedList: readonly string[]): boolean {
  let matched = false;
  for (const expected of expectedList) {
    if (secretsMatch(provided, expected)) {
      matched = true;
    }
  }
  return matched;
}

function readProvidedSecret(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return req.headers.get('x-telemetry-secret') || req.headers.get('x-webhook-secret') || bearer;
}

/**
 * Telemetry writes and reads are safety-relevant: unsigned callers could poison
 * or observe the values SCADA views consume. In non-production an unconfigured
 * secret is tolerated so local development keeps working; production fails closed.
 */
function authorize({ req, secret, label }: AuthorizeOptions): NextResponse | null {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: `${label} is not configured.` }, { status: 503 });
    }
    return null;
  }

  const provided = readProvidedSecret(req);
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: `Unauthorized ${label.toLowerCase()}.` }, { status: 401 });
  }

  return null;
}

export function authorizeIngest(req: Request): NextResponse | null {
  return authorize({
    req,
    secret: configuredSecret(['TELEMETRY_INGEST_SECRET', 'TELEMETRY_WEBHOOK_SECRET']),
    label: 'Telemetry ingest',
  });
}

export function authorizeTelemetryStream(req: Request): NextResponse | null {
  return authorize({
    req,
    secret: configuredSecret([
      'TELEMETRY_STREAM_SECRET',
      'TELEMETRY_INGEST_SECRET',
      'TELEMETRY_WEBHOOK_SECRET',
    ]),
    label: 'Telemetry stream',
  });
}

export function authorizeWorkflowRequest(req: Request): NextResponse | null {
  const secret = configuredSecret(['DISPATCH_API_KEY', 'TELEMETRY_INGEST_SECRET']);
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_API_KEY === 'true') {
      return NextResponse.json(
        { success: false, error: 'Workflow dispatch authentication is not configured.' },
        { status: 503 }
      );
    }
    return null;
  }

  const provided = readProvidedSecret(req);
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

const BEARER_PREFIX = 'Bearer ';

/**
 * n8n-compatible Redis proxy auth (`X-N8N-API-KEY`, `x-redis-token`, or `Authorization`).
 * Fails closed: an unconfigured secret never authorizes any caller.
 */
export function authorizeRedisProxyRequest(req: Request): boolean {
  const acceptedSecrets = configuredSecrets(['REDIS_AUTH_SECRET', 'N8N_API_KEY']);
  if (acceptedSecrets.length === 0) return false;

  const apiKey = req.headers.get('x-n8n-api-key');
  if (apiKey && matchesAnySecret(apiKey, acceptedSecrets)) return true;

  const redisToken = req.headers.get('x-redis-token');
  if (redisToken && matchesAnySecret(redisToken, acceptedSecrets)) return true;

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length)
    : authHeader;
  return matchesAnySecret(token, acceptedSecrets);
}
