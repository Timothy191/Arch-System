import { launchTier2DesktopSchema, protocolOptionsSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { cacheSet } from '@repo/redis';
import {
  getAuthenticatedEmployee,
  type Json,
  type RemoteSupportDevicesRow,
  type RemoteSupportSessionsRow,
} from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { type NextRequest, NextResponse } from 'next/server';
import {
  encryptTier2LaunchToken,
  TIER2_TOKEN_TTL_SECONDS,
} from '@/features/remote-support/lib/tier2-token';
import { withBodyLimit } from '@/lib/api/body-limit';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';

const TIER2_ALLOWED_ROLES = new Set(['admin', 'supervisor']);
const JTI_REDIS_TTL_SECONDS = TIER2_TOKEN_TTL_SECONDS + 30;

async function handleTier2LaunchPost(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!TIER2_ALLOWED_ROLES.has(principal.employee.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const validated = await validateBody(request, launchTier2DesktopSchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const gatewayWsUrl =
    process.env.REMOTE_DESKTOP_GATEWAY_URL ?? process.env.NEXT_PUBLIC_REMOTE_DESKTOP_GATEWAY_URL;
  const tokenSecret = process.env.REMOTE_DESKTOP_TOKEN_SECRET;

  if (!gatewayWsUrl || !tokenSecret) {
    return NextResponse.json(
      {
        error:
          'Tier 2 Remote Desktop Gateway is not configured (REMOTE_DESKTOP_GATEWAY_URL / REMOTE_DESKTOP_TOKEN_SECRET missing).',
      },
      { status: 503 }
    );
  }

  const [deviceResult, sessionResult] = await Promise.all([
    supabase
      .from('remote_support_devices')
      .select('*')
      .eq('id', validated.data.deviceId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('remote_support_sessions')
      .select('*')
      .eq('id', validated.data.sessionId)
      .maybeSingle(),
  ]);

  if (deviceResult.error || sessionResult.error) {
    return NextResponse.json(
      { error: 'Failed to verify Tier 2 launch prerequisites' },
      { status: 500 }
    );
  }
  if (!deviceResult.data || !sessionResult.data) {
    return NextResponse.json({ error: 'Device or support session not found' }, { status: 404 });
  }

  const device = deviceResult.data as RemoteSupportDevicesRow;
  const session = sessionResult.data as RemoteSupportSessionsRow;

  if (session.status !== 'active') {
    return NextResponse.json(
      { error: 'Support session must be active before launching Tier 2 OS desktop' },
      { status: 403 }
    );
  }

  if (device.require_user_consent && !session.consent_granted_at) {
    return NextResponse.json(
      { error: 'Explicit employee consent is required before connecting to this workstation' },
      { status: 403 }
    );
  }

  if (!device.require_user_consent && principal.employee.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins may launch unattended Tier 2 desktop connections' },
      { status: 403 }
    );
  }

  const parsedOptions = protocolOptionsSchema.safeParse(device.protocol_options ?? {});
  const protocolOptions = parsedOptions.success ? parsedOptions.data : {};

  let minted: { readonly token: string; readonly jti: string; readonly expiresAt: string };
  try {
    minted = encryptTier2LaunchToken({
      secret: tokenSecret,
      sessionId: session.id,
      actorId: principal.employee.id,
      deviceId: device.id,
      protocol: device.protocol,
      settings: {
        hostname: device.network_host,
        port: device.network_port,
        username: validated.data.username,
        password: validated.data.password,
        domain: validated.data.domain ?? protocolOptions.domain,
        security: protocolOptions.security,
        ignoreCert: protocolOptions.ignoreCert,
        colorDepth: protocolOptions.colorDepth,
        resizeMethod: protocolOptions.resizeMethod,
        readOnly: protocolOptions.readOnly,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mint Tier 2 launch token' },
      { status: 503 }
    );
  }

  await cacheSet(`support:t2:jti:issued:${minted.jti}`, '1', JTI_REDIS_TTL_SECONDS).catch((err) => {
    logger.warn({
      event: 'tier2_jti_redis_store_failed',
      jti: minted.jti,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  });

  const serviceClient = createServiceRoleClient();
  const [auditResult, deviceUpdateResult] = await Promise.all([
    supabase.from('remote_support_audit_events').insert({
      session_id: session.id,
      actor_employee_id: principal.employee.id,
      event_type: 'tier2_token_issued',
      metadata: {
        deviceId: device.id,
        hostname: device.hostname,
        protocol: device.protocol,
        jti: minted.jti,
      } as Json,
    }),
    serviceClient
      .from('remote_support_devices')
      .update({ last_connected_at: new Date().toISOString() })
      .eq('id', device.id),
  ]);

  if (auditResult.error) {
    return NextResponse.json(
      { error: 'Failed to persist mandatory Tier 2 launch audit event' },
      { status: 500 }
    );
  }
  if (deviceUpdateResult.error) {
    logger.warn({
      event: 'tier2_device_last_connected_update_failed',
      deviceId: device.id,
      errorMessage: deviceUpdateResult.error.message,
    });
  }

  logger.info({
    event: 'tier2_launch_token_issued',
    sessionId: session.id,
    deviceId: device.id,
    actorId: principal.employee.id,
  });

  return NextResponse.json(
    {
      gatewayWsUrl,
      token: minted.token,
      expiresAt: minted.expiresAt,
      protocol: device.protocol,
      hostname: device.hostname,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, () => withBodyLimit(request, () => handleTier2LaunchPost(request)));
}
