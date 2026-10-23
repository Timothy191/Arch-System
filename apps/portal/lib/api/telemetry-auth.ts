import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

function configuredSecret(names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value;
  }
  return null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
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
function authorize(req: Request, secret: string | null, label: string): NextResponse | null {
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
  return authorize(
    req,
    configuredSecret(['TELEMETRY_INGEST_SECRET', 'TELEMETRY_WEBHOOK_SECRET']),
    'Telemetry ingest'
  );
}

export function authorizeTelemetryStream(req: Request): NextResponse | null {
  return authorize(
    req,
    configuredSecret([
      'TELEMETRY_STREAM_SECRET',
      'TELEMETRY_INGEST_SECRET',
      'TELEMETRY_WEBHOOK_SECRET',
    ]),
    'Telemetry stream'
  );
}
