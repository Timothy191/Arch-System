import { musterEventsSchema } from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

interface UntypedMusterTable {
  select: (columns: string) => {
    order: (
      col: string,
      opts?: { ascending?: boolean }
    ) => {
      limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
    };
  };
}

function fromMusterTable(supabase: unknown): UntypedMusterTable {
  return (supabase as { from: (t: string) => UntypedMusterTable }).from('muster_events');
}

export async function GET() {
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await fromMusterTable(supabase)
      .select(
        'id, personnel_id, employee_id, badge_code, full_name, muster_point, status, notes, recorded_by, recorded_at'
      )
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DB_ERROR' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Failed to load muster events',
          code: 'INTERNAL_ERROR',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    rawEntityId
  );

  const candidate = {
    personnel_id: isUuid ? rawEntityId : null,
    employee_id: principal.employee?.id ?? null,
    badge_code: body.badge_code ? String(body.badge_code).trim() : rawEntityId || null,
    full_name: String(
      body.full_name ?? body.entityName ?? body.name ?? (rawEntityId || 'Site Personnel')
    ).trim(),
    muster_point: String(body.muster_point ?? body.station ?? 'Primary Assembly Point A').trim(),
    status: normalizedStatus,
    notes: body.notes ? String(body.notes).trim() : null,
    recorded_by: principal.employee?.id ?? null,
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

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await fromMusterTable(supabase)
      .insert({
        personnel_id: parsed.data.personnel_id ?? null,
        employee_id: parsed.data.employee_id ?? null,
        badge_code: parsed.data.badge_code ?? null,
        full_name: parsed.data.full_name,
        muster_point: parsed.data.muster_point,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        recorded_by: parsed.data.recorded_by ?? null,
      })
      .select('id, personnel_id, full_name, muster_point, status, recorded_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'DB_ERROR' } },
        { status: 500 }
      );
    }

    revalidatePath('/access-control/muster');
    revalidatePath('/access-control');

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Failed to record muster status',
          code: 'INTERNAL_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
