/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: Ingest a system log entry
 *     description: >
 *       Accepts structured log entries (client runtime errors, CSP violations,
 *       server-side events) and persists them to public.system_logs for the
 *       Administration "System Logs" console. Authentication is optional so
 *       pre-auth errors (e.g. login page) are still captured; identity fields
 *       are derived server-side and cannot be forged by the client.
 *     tags:
 *       - System
 *       - Logging
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSystemLogEntry'
 *     responses:
 *       201:
 *         description: Log entry accepted
 *       400:
 *         description: Invalid payload
 *       429:
 *         description: Rate limit exceeded
 *   get:
 *     summary: List system log entries
 *     description: Admin-only paginated query with level/source/resolved/search filters.
 *     tags:
 *       - System
 *       - Logging
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error, fatal]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [client, server, api, cron, csp, integration, auth]
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated log entries
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 *   patch:
 *     summary: Update log resolution state
 *     description: Admin-only bulk triage — mark entries resolved or unresolved.
 *     tags:
 *       - System
 *       - Logging
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               resolved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Resolution updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 */

import {
  createSystemLogEntrySchema,
  systemLogQuerySchema,
  updateSystemLogResolutionSchema,
} from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getClientIp, withRateLimit } from '@/lib/api/rate-limit-middleware';
import { recordSystemLog } from '@/lib/logging/system-logs';

const INGEST_LIMIT = { windowMs: 60_000, maxRequests: 60 };

async function assertAdmin() {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return { error: 'Unauthorized', status: 401 as const };
  if (principal.employee?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 as const };
  }
  return { principal };
}

async function handlePost(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const parsed = createSystemLogEntrySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid log entry',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  // Identity is derived from the session/request — never trusted from the body.
  const principal = await getAuthenticatedEmployee().catch(() => null);
  const entry = parsed.data;

  await recordSystemLog({
    ...entry,
    employeeId: principal?.employee?.id ?? null,
    departmentId: principal?.employee?.department_id ?? null,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
  });

  // 201 even when persistence silently failed — telemetry must not break clients.
  return NextResponse.json({ success: true }, { status: 201 });
}

async function handleGet(request: NextRequest) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const parsed = systemLogQuerySchema.safeParse({
    level: searchParams.get('level') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    resolved: searchParams.get('resolved') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const { level, source, category, resolved, search, page, pageSize } = parsed.data;

  let query = supabase
    .from('system_logs')
    .select('*, employees!system_logs_employee_id_fkey(full_name)', { count: 'exact' });

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);
  if (category) query = query.eq('category', category);
  if (resolved !== undefined) query = query.eq('resolved', resolved === 'true');
  if (search) {
    query = query.or(`message.ilike.%${search}%,category.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load system logs', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    pagination: {
      page,
      pageSize,
      totalCount: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}

async function handlePatch(request: NextRequest) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const parsed = updateSystemLogResolutionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid resolution payload', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { ids, resolved } = parsed.data;

  const { error } = await supabase
    .from('system_logs')
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? (auth.principal.employee?.id ?? null) : null,
    })
    .in('id', ids);

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update log entries', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, updated: ids.length });
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, () => handlePost(request), { customLimit: INGEST_LIMIT });
}

export async function GET(request: NextRequest) {
  return handleGet(request);
}

export async function PATCH(request: NextRequest) {
  return handlePatch(request);
}
