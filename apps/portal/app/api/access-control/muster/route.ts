import { musterEventsSchema } from '@repo/contract';
import { logger } from '@repo/logger/server';
import { cacheInvalidateTags, cacheWrap } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { CANONICAL_MUSTER_STATIONS } from '@/app/(departments)/access-control/actions/constants';
import {
  hasAccessControlDepartmentPermission,
  hasAccessControlWritePermission,
  resolveAccessControlDeptId,
} from '@/app/(departments)/access-control/actions/shared';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const IDEMPOTENCY_TTL_SECONDS = 300;

export async function GET(req: NextRequest) {
  return withRateLimit(
    req,
    async () => {
      const supabase = await createServerSupabaseClient();
      const principal = await getAuthenticatedEmployee(supabase);
      if (!principal?.employee) {
        return NextResponse.json(
          { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
          { status: 401 }
        );
      }

      const deptId = await resolveAccessControlDeptId();
      if (!hasAccessControlDepartmentPermission(principal.employee, deptId)) {
        return NextResponse.json(
          { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      }

      try {
        const { data, error } = await supabase
          .from('muster_events')
          .select(
            'id, personnel_id, visitor_id, employee_id, badge_code, full_name, muster_point, status, notes, recorded_by, recorded_at'
          )
          .order('recorded_at', { ascending: false })
          .limit(500);

        if (error) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'Failed to load muster events', code: 'DB_ERROR' },
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: data ?? [],
        });
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Failed to load muster events',
              code: 'INTERNAL_ERROR',
            },
          },
          { status: 500 }
        );
      }
    },
    { customLimit: { windowMs: 60_000, maxRequests: 60 } }
  );
}

export async function POST(req: NextRequest) {
  return withRateLimit(
    req,
    async () => {
      const supabase = await createServerSupabaseClient();
      const principal = await getAuthenticatedEmployee(supabase);
      if (!principal?.employee) {
        return NextResponse.json(
          { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
          { status: 401 }
        );
      }

      const deptId = await resolveAccessControlDeptId();
      if (!hasAccessControlWritePermission(principal.employee, deptId)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Forbidden: access-control write permission required',
              code: 'FORBIDDEN',
            },
          },
          { status: 403 }
        );
      }

      const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
      if (idempotencyKey) {
        let isDuplicate = true;
        try {
          await cacheWrap(
            `muster:idem:${idempotencyKey}`,
            async () => {
              isDuplicate = false;
              return { claimed: true };
            },
            IDEMPOTENCY_TTL_SECONDS
          );
        } catch {
          isDuplicate = false;
        }
        if (isDuplicate) {
          return NextResponse.json({ success: true, deduplicated: true });
        }
      }

      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid JSON payload', code: 'VALIDATION_ERROR' } },
          { status: 400 }
        );
      }

      const rawStatus = String(body.status ?? 'accounted').trim();
      const normalizedStatus = rawStatus === 'unaccounted' ? 'missing' : rawStatus;
      const rawEntityId = String(body.personnel_id ?? body.entityId ?? '').trim();
      const entityType = body.entityType === 'visitor' ? 'visitor' : 'personnel';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawEntityId
      );

      const candidate = {
        personnel_id: entityType === 'personnel' && isUuid ? rawEntityId : null,
        employee_id: principal.employee.id,
        badge_code: body.badge_code ? String(body.badge_code).trim() : rawEntityId || null,
        full_name: String(
          body.full_name ?? body.entityName ?? body.name ?? (rawEntityId || 'Site Personnel')
        ).trim(),
        muster_point: String(
          body.muster_point ?? body.station ?? CANONICAL_MUSTER_STATIONS[0].name
        ).trim(),
        status: normalizedStatus,
        notes: body.notes ? String(body.notes).trim() : null,
        recorded_by: principal.employee.id,
      };

      const parsed = musterEventsSchema.safeParse(candidate);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: parsed.error.issues[0]?.message ?? 'Invalid muster event payload',
              code: 'VALIDATION_ERROR',
            },
          },
          { status: 400 }
        );
      }

      const clientRecordedAt =
        typeof body.recordedAt === 'string' && !Number.isNaN(Date.parse(body.recordedAt))
          ? new Date(body.recordedAt).toISOString()
          : new Date().toISOString();

      try {
        const { data, error } = await supabase
          .from('muster_events')
          .insert({
            personnel_id: parsed.data.personnel_id ?? null,
            visitor_id: entityType === 'visitor' && isUuid ? rawEntityId : null,
            department_id: deptId,
            employee_id: parsed.data.employee_id ?? null,
            badge_code: parsed.data.badge_code ?? null,
            full_name: parsed.data.full_name,
            muster_point: parsed.data.muster_point,
            status: parsed.data.status,
            notes: parsed.data.notes ?? null,
            recorded_by: principal.employee.id,
            recorded_at: clientRecordedAt,
          })
          .select('id, personnel_id, visitor_id, full_name, muster_point, status, recorded_at')
          .maybeSingle();

        if (error) {
          logger.error({ event: 'muster_api_insert_failed', err: error });
          return NextResponse.json(
            {
              success: false,
              error: { message: 'Failed to record muster status', code: 'DB_ERROR' },
            },
            { status: 500 }
          );
        }

        logger.info({
          event: 'muster_event_recorded',
          actorId: principal.employee.id,
          entityId: rawEntityId,
          entityType,
          status: parsed.data.status,
        });

        await cacheInvalidateTags(['table:muster_events', ...(deptId ? [`dept:${deptId}`] : [])]);
        revalidatePath('/access-control/muster');
        revalidatePath('/access-control');

        return NextResponse.json({
          success: true,
          data,
        });
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Failed to record muster status',
              code: 'INTERNAL_ERROR',
            },
          },
          { status: 500 }
        );
      }
    },
    { customLimit: { windowMs: 60_000, maxRequests: 60 } }
  );
}
