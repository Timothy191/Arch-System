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
 *       413:
 *         description: Request body too large
 *       429:
 *         description: Rate limit exceeded
 *   get:
 *     summary: List system log entries
 *     description: Admin-only paginated query with level/source/category/resolved/search filters.
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
 *         name: category
 *         schema:
 *           type: string
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
 *       429:
 *         description: Rate limit exceeded
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
 *       429:
 *         description: Rate limit exceeded
 */

import {
  createSystemLogEntrySchema,
  systemLogQuerySchema,
  updateSystemLogResolutionSchema,
} from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { getClientIp, withRateLimit } from '@/lib/api/rate-limit-middleware';
import { recordSystemLog } from '@/lib/logging/system-logs';
import { extractRequestTraceMetadata } from '@/lib/observability/tracing';
import { sanitizePostgrestFilterValue } from '@/lib/supabase-filter';

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;
const MAX_LOG_INGEST_BODY_BYTES = 65_536;
const INGEST_LIMIT = { windowMs: 60_000, maxRequests: 60 };
const ADMIN_QUERY_LIMIT = { windowMs: 60_000, maxRequests: 120 };
const ADMIN_PATCH_LIMIT = { windowMs: 60_000, maxRequests: 60 };

async function assertAdmin() {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return { error: 'Unauthorized', status: HTTP_UNAUTHORIZED };
  if (principal.employee?.role !== 'admin') {
    return { error: 'Forbidden', status: HTTP_FORBIDDEN };
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
      { status: HTTP_BAD_REQUEST }
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
      { status: HTTP_BAD_REQUEST }
    );
  }

  const principal = await getAuthenticatedEmployee().catch(() => null);
  const ipAddress = getClientIp(request);
  const entry = parsed.data;
  const headerTraceMeta = extractRequestTraceMetadata(request.headers);

  await recordSystemLog({
    ...entry,
    traceId: entry.traceId ?? headerTraceMeta.traceId,
    requestId: entry.requestId ?? headerTraceMeta.requestId,
    employeeId: principal?.employee?.id ?? null,
    departmentId: principal?.employee?.department_id ?? null,
    ipAddress,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true }, { status: HTTP_CREATED });
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
      { status: HTTP_BAD_REQUEST }
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
    const sanitizedSearch = sanitizePostgrestFilterValue(search);
    if (sanitizedSearch.length > 0) {
      query = query.or(
        `message.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%,trace_id.ilike.%${sanitizedSearch}%,request_id.ilike.%${sanitizedSearch}%`
      );
    }
  }

  const fromOffset = (page - 1) * pageSize;
  query = query
    .order('created_at', { ascending: false })
    .range(fromOffset, fromOffset + pageSize - 1);

  const { data: logRows, count, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load system logs', code: 'DATABASE_ERROR' },
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: logRows ?? [],
      pagination: {
        page,
        pageSize,
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
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
      { status: HTTP_BAD_REQUEST }
    );
  }

  const parsed = updateSystemLogResolutionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid resolution payload', code: 'VALIDATION_ERROR' },
      { status: HTTP_BAD_REQUEST }
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
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  return NextResponse.json({ success: true, updated: ids.length });
}

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    () => withBodyLimit(request, () => handlePost(request), { maxSize: MAX_LOG_INGEST_BODY_BYTES }),
    { customLimit: INGEST_LIMIT }
  );
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, () => handleGet(request), { customLimit: ADMIN_QUERY_LIMIT });
}

export async function PATCH(request: NextRequest) {
  return withRateLimit(request, () => handlePatch(request), { customLimit: ADMIN_PATCH_LIMIT });
}
