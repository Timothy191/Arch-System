import { timingSafeEqual } from 'node:crypto';
import { gateHeartbeatSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { cacheInvalidateTags } from '@repo/redis/cache';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { NextResponse } from 'next/server';
import { triggerOperationalAlertWorkflow } from '@/lib/alerts/operational-alert-triggers';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const HEARTBEAT_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 120 };

function constantTimeEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

function authorizeHeartbeatRequest(req: Request): NextResponse | null {
  const scannerKey = process.env.SCANNER_API_KEY?.trim() ?? '';
  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';
  const secrets = [scannerKey, cronSecret].filter((secret) => secret.length > 0);

  if (secrets.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Heartbeat authentication secret is not configured' },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const apiKeyHeader = req.headers.get('x-api-key')?.trim() ?? '';
  const providedToken = bearerToken || apiKeyHeader;

  if (!providedToken) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const isAuthorized = secrets.some((secret) => constantTimeEquals(providedToken, secret));
  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function POST(req: Request) {
  const authError = authorizeHeartbeatRequest(req);
  if (authError) {
    return authError;
  }

  return withRateLimit(
    req,
    async () => {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON request body' },
          { status: 400 }
        );
      }

      const parsed = gateHeartbeatSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Invalid heartbeat payload',
          },
          { status: 400 }
        );
      }

      const {
        gateId,
        gateLocation,
        interlockActive,
        isMaintenance,
        faultMessage,
        firmwareVersion,
      } = parsed.data;

      const nowIso = new Date().toISOString();
      const updatePayload: {
        last_heartbeat_at: string;
        updated_at: string;
        interlock_active?: boolean;
        is_maintenance?: boolean;
      } = {
        last_heartbeat_at: nowIso,
        updated_at: nowIso,
      };

      if (typeof interlockActive === 'boolean') {
        updatePayload.interlock_active = interlockActive;
      }
      if (typeof isMaintenance === 'boolean') {
        updatePayload.is_maintenance = isMaintenance;
      }

      const supabase = createServiceRoleClient();
      const baseQuery = supabase.from('perimeter_gates').update(updatePayload);
      const filteredQuery = gateId
        ? baseQuery.eq('id', gateId)
        : baseQuery.eq('gate_location', gateLocation ?? '');

      const { data: gate, error } = await filteredQuery
        .select(
          'id, name, gate_location, zone, last_heartbeat_at, interlock_active, is_maintenance, department_id'
        )
        .maybeSingle();

      if (error) {
        logger.error({ event: 'gate_heartbeat_update_failed', error: error.message });
        return NextResponse.json(
          { success: false, error: 'Failed to update gate heartbeat' },
          { status: 500 }
        );
      }

      if (!gate) {
        return NextResponse.json({ success: false, error: 'Gate not found' }, { status: 404 });
      }

      const tags = [
        'access-control',
        ...(gate.department_id ? [`dept:${gate.department_id}`] : []),
      ];
      await cacheInvalidateTags(tags).catch((err: unknown) => {
        logger.warn({
          event: 'gate_heartbeat_cache_invalidate_failed',
          gateId: gate.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      logger.info({
        event: 'gate_heartbeat_recorded',
        gateId: gate.id,
        gateLocation: gate.gate_location,
        firmwareVersion: firmwareVersion ?? null,
        hasFault: Boolean(faultMessage && faultMessage.length > 0),
      });

      await triggerOperationalAlertWorkflow({
        event: {
          eventType: 'gate.heartbeat.fault',
          source: 'api.access-control.gates.heartbeat',
          gateId: gate.id,
          gateName: gate.name,
          gateLocation: gate.gate_location,
          faultMessage: faultMessage ?? '',
          isMaintenance: gate.is_maintenance,
          interlockActive: gate.interlock_active,
          firmwareVersion: firmwareVersion ?? null,
          timestamp: nowIso,
        },
      });

      return NextResponse.json({ success: true, gate });
    },
    { customLimit: HEARTBEAT_RATE_LIMIT }
  );
}

export async function GET(req: Request) {
  const authError = authorizeHeartbeatRequest(req);
  if (authError) {
    return authError;
  }

  return withRateLimit(
    req,
    async () => {
      const supabase = createServiceRoleClient();
      const { data: gates, error } = await supabase
        .from('perimeter_gates')
        .select(
          'id, name, gate_location, zone, gate_type, last_heartbeat_at, interlock_active, is_maintenance, department_id'
        )
        .order('id', { ascending: true });

      if (error) {
        logger.error({ event: 'gate_heartbeat_list_failed', error: error.message });
        return NextResponse.json(
          { success: false, error: 'Failed to fetch perimeter gates' },
          { status: 500 }
        );
      }

      const nowMs = Date.now();
      let online = 0;
      let offline = 0;
      let maintenance = 0;

      const enrichedGates = (gates ?? []).map((gate) => {
        let status: 'MAINTENANCE' | 'ONLINE' | 'OFFLINE' = 'OFFLINE';
        if (gate.is_maintenance) {
          status = 'MAINTENANCE';
          maintenance += 1;
        } else if (
          gate.last_heartbeat_at &&
          nowMs - new Date(gate.last_heartbeat_at).getTime() <= HEARTBEAT_ONLINE_WINDOW_MS
        ) {
          status = 'ONLINE';
          online += 1;
        } else {
          offline += 1;
        }

        return {
          ...gate,
          status,
        };
      });

      return NextResponse.json({
        success: true,
        summary: {
          total: enrichedGates.length,
          online,
          offline,
          maintenance,
        },
        gates: enrichedGates,
      });
    },
    { customLimit: HEARTBEAT_RATE_LIMIT }
  );
}
