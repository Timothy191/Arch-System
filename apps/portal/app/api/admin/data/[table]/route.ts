/**
 * @swagger
 * /api/admin/data/{table}:
 *   get:
 *     summary: Query admin data tables
 *     description: Query operational tables (machines, daily_logs, breakdowns, etc.) with pagination and soft-delete filtering. Admin-only access.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name (must be in OPERATIONAL_TABLES whitelist)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Maximum number of records (default 50)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Pagination offset (default 0)
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *           pattern: '^[a-z_][a-z0-9_]*$'
 *         description: Sort column identifier (default created_at)
 *       - in: query
 *         name: order_dir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction (default desc)
 *     responses:
 *       200:
 *         description: Query results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                 count:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       400:
 *         description: Invalid query parameters or order_by column
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 *       404:
 *         description: Table not found or not allowed
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Insert into admin data tables
 *     description: Insert records into operational tables. Admin-only access with audit logging and cache invalidation.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name (must be in OPERATIONAL_TABLES whitelist)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Record to insert (schema depends on table)
 *     responses:
 *       200:
 *         description: Insert successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid JSON or insert payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 *       404:
 *         description: Table not found or not allowed
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update admin data tables
 *     description: Update records in operational tables by id. Admin-only access with rate limiting for machine status updates.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name (must be in OPERATIONAL_TABLES whitelist)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: string
 *             description: Record updates including target record id
 *     responses:
 *       200:
 *         description: Update successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid JSON or missing record id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 *       404:
 *         description: Table or target record not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete from admin data tables
 *     description: Delete a record from an operational table using ?id=<recordId>. Admin-only access.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name (must be in OPERATIONAL_TABLES whitelist)
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Record identifier to delete (?id=<recordId>)
 *     responses:
 *       200:
 *         description: Delete successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Missing id query parameter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin-only)
 *       404:
 *         description: Table or target record not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */

import {
  adminDataDeleteSchema,
  adminDataInsertSchema,
  adminDataQuerySchema,
  adminDataUpdateSchema,
} from '@repo/contract/schemas/admin.schema';
import { serverLogger } from '@repo/logger';
import { FixedWindowStrategy, RateLimiter, RedisStore } from '@repo/rate-limiter';
import { getRedisClient } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { tagTable, updateTags } from '@/lib/server-cache';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const MACHINE_STATUS_RATE_LIMIT = 10;
const MACHINE_STATUS_WINDOW_MS = 60_000;
const SAFE_COLUMN_IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/;

const OPERATIONAL_TABLES = new Set([
  'machines',
  'daily_logs',
  'machine_hours',
  'fuel_logs',
  'production_logs',
  'machine_operations',
  'hourly_loads',
  'delay_entries',
  'delay_categories',
  'engineering_notes',
  'shift_status',
  'excavator_activity',
  'excavator_dumper_assignments',
  'dozer_rolls',
  'breakdowns',
  'drill_operations',
  'documents',
  'document_versions',
  'machine_configurations',
  'operators',
  'sites',
  'mine_blocks',
  'report_templates',
  'generated_reports',
  'personnel',
  'visitors',
  'badges',
  'fleet',
  'equipment',
  'access_logs',
]);

const SOFT_DELETE_OPERATIONAL_TABLES = new Set([
  'machines',
  'delay_entries',
  'delay_categories',
  'breakdowns',
  'documents',
  'operators',
  'sites',
  'mine_blocks',
  'report_templates',
]);

const APPEND_ONLY_TABLES = new Set(['access_logs']);

const DEFAULT_SORT_BY_TABLE: Readonly<Record<string, string>> = {
  access_logs: 'scanned_at',
  badges: 'issued_at',
  generated_reports: 'generated_at',
};

const IMMUTABLE_MUTATION_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);

function sanitizeMutationPayload(rawPayload: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawPayload)) {
    if (!SAFE_COLUMN_IDENTIFIER_REGEX.test(key) || IMMUTABLE_MUTATION_FIELDS.has(key)) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

interface AdminAuditWriteOptions {
  serviceRole: ReturnType<typeof createServiceRoleClient>;
  action: 'insert' | 'update' | 'delete';
  table: string;
  recordId: string | null;
  oldData: unknown;
  newData?: unknown;
  performedBy: string;
}

async function getMachineStatusRateLimiter(): Promise<RateLimiter | null> {
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      const store = new RedisStore(redis);
      const strategy = new FixedWindowStrategy();
      return new RateLimiter({
        store,
        strategy,
        limit: MACHINE_STATUS_RATE_LIMIT,
        windowMs: MACHINE_STATUS_WINDOW_MS,
        keyPrefix: 'machine_status_update:',
      });
    }
  } catch (error) {
    serverLogger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Redis unavailable; machine status rate limiting disabled'
    );
  }
  return null;
}

async function assertAdmin(): Promise<
  | { error: string; status: 401 | 403 }
  | { employee: { id: string; role: string }; user: { id: string } }
> {
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) return { error: 'Unauthorized', status: HTTP_UNAUTHORIZED };
  if (principal.employee.role !== 'admin') {
    return { error: 'Forbidden', status: HTTP_FORBIDDEN };
  }
  return {
    employee: principal.employee,
    user: principal.user,
  };
}

async function parseJsonRequestBody(
  request: NextRequest
): Promise<{ isOk: true; body: unknown } | { isOk: false; response: NextResponse }> {
  try {
    const body = await request.json();
    return { isOk: true, body };
  } catch {
    return {
      isOk: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Invalid JSON body', code: 'VALIDATION_ERROR' } },
        { status: HTTP_BAD_REQUEST }
      ),
    };
  }
}

async function fetchExistingRecord(
  serviceRole: ReturnType<typeof createServiceRoleClient>,
  options: { table: string; id: string }
): Promise<Record<string, unknown> | null> {
  const lookup = serviceRole.from(options.table).select('*').eq('id', options.id);
  const { data: existingRow } = await (typeof lookup.maybeSingle === 'function'
    ? lookup.maybeSingle()
    : lookup.single());
  return (existingRow as Record<string, unknown> | null) ?? null;
}

async function writeAuditLogSafely(options: AdminAuditWriteOptions): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      action: options.action,
      table_name: options.table,
      record_id: options.recordId,
      old_data: options.oldData ?? null,
      performed_by: options.performedBy,
      ...(options.newData !== undefined ? { new_data: options.newData } : {}),
    };

    const result = await options.serviceRole.from('audit_logs').insert(payload);
    if (result?.error) {
      serverLogger.error(
        {
          error: result.error.message ?? String(result.error),
          table: options.table,
          action: options.action,
          recordId: options.recordId,
        },
        'Failed to insert admin data audit log'
      );
    }
  } catch (error) {
    serverLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        table: options.table,
        action: options.action,
        recordId: options.recordId,
      },
      'Exception while inserting admin data audit log'
    );
  }
}

function buildInvalidationTags(table: string): string[] {
  if (table === 'machines') {
    return [tagTable('machines'), tagTable('fleet'), tagTable('equipment')];
  }
  return [tagTable(table)];
}

async function handleGetRequest(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { table: rawTable } = await params;
  const table = rawTable.toLowerCase();
  if (!OPERATIONAL_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Unknown table', code: 'API_ERROR' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  const defaultSort = DEFAULT_SORT_BY_TABLE[table] ?? 'created_at';
  if (APPEND_ONLY_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Table is append-only', code: 'FORBIDDEN' } },
      { status: 405 }
    );
  }

  const { searchParams } = request.nextUrl;
  const parsedQuery = adminDataQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
    order_by: searchParams.get('order_by') ?? defaultSort,
    order_dir: searchParams.get('order_dir') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid query parameters', code: 'VALIDATION_ERROR' } },
      { status: HTTP_BAD_REQUEST }
    );
  }
  const { limit, offset, order_by: orderBy, order_dir: orderDir } = parsedQuery.data;

  if (!SAFE_COLUMN_IDENTIFIER_REGEX.test(orderBy)) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Invalid order_by column identifier', code: 'VALIDATION_ERROR' },
      },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const serviceRole = createServiceRoleClient();
  let tableQuery = serviceRole.from(table).select('*', { count: 'exact' });
  if (SOFT_DELETE_OPERATIONAL_TABLES.has(table) && typeof tableQuery.is === 'function') {
    tableQuery = tableQuery.is('deleted_at', null);
  }

  const {
    data: rows,
    error,
    count,
  } = await tableQuery
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Database query failed', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  return NextResponse.json({ data: rows, count, limit, offset });
}

async function handlePostRequest(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { table: rawTable } = await params;
  const table = rawTable.toLowerCase();
  if (!OPERATIONAL_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Unknown table', code: 'API_ERROR' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  const jsonBody = await parseJsonRequestBody(request);
  if (!jsonBody.isOk) {
    return jsonBody.response;
  }

  const parsedBody = adminDataInsertSchema.safeParse(jsonBody.body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid insert payload', code: 'VALIDATION_ERROR' } },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const sanitizedInsert = sanitizeMutationPayload(parsedBody.data);
  if (Object.keys(sanitizedInsert).length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'No writable fields supplied', code: 'VALIDATION_ERROR' },
      },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const serviceRole = createServiceRoleClient();
  const { data: inserted, error } = await serviceRole
    .from(table)
    .insert(sanitizedInsert)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Insert failed', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  await writeAuditLogSafely({
    serviceRole,
    action: 'insert',
    table,
    recordId: (inserted as { id?: string } | null)?.id ?? null,
    oldData: null,
    newData: parsedBody.data,
    performedBy: auth.employee.id,
  });

  await updateTags(buildInvalidationTags(table));

  return NextResponse.json({ success: true, data: inserted });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withRateLimit(request, () => handlePostRequest(request, { params }));
}

async function handlePutRequest(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { table: rawTable } = await params;
  const table = rawTable.toLowerCase();
  if (!OPERATIONAL_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Unknown table', code: 'API_ERROR' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  if (APPEND_ONLY_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Table is append-only', code: 'FORBIDDEN' } },
      { status: 405 }
    );
  }

  const jsonBody = await parseJsonRequestBody(request);
  if (!jsonBody.isOk) {
    return jsonBody.response;
  }

  const parsedBody = adminDataUpdateSchema.safeParse(jsonBody.body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Missing record id', code: 'VALIDATION_ERROR' } },
      { status: HTTP_BAD_REQUEST }
    );
  }
  const { id, data: nestedData, ...rest } = parsedBody.data;
  const rawUpdatePayload =
    nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)
      ? (nestedData as Record<string, unknown>)
      : rest;
  const updatePayload = sanitizeMutationPayload(rawUpdatePayload);
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'No writable fields supplied', code: 'VALIDATION_ERROR' },
      },
      { status: HTTP_BAD_REQUEST }
    );
  }

  if (table === 'machines' && 'active' in updatePayload) {
    const rateLimiter = await getMachineStatusRateLimiter();
    if (rateLimiter) {
      const rateLimitResult = await rateLimiter.check(id);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Too many status updates for this machine. Please try again later.',
            retryAfter: rateLimitResult.retryAfter,
          },
          { status: HTTP_TOO_MANY_REQUESTS }
        );
      }
    }
  }

  const serviceRole = createServiceRoleClient();
  const beforeRecord = await fetchExistingRecord(serviceRole, { table, id });
  if (!beforeRecord) {
    return NextResponse.json(
      { success: false, error: { message: 'Record not found', code: 'NOT_FOUND' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  const { count: updatedCount, error } = await serviceRole
    .from(table)
    .update(updatePayload, { count: 'exact' })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Update failed', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  if (updatedCount === 0) {
    return NextResponse.json(
      { success: false, error: { message: 'Record not found', code: 'NOT_FOUND' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  await writeAuditLogSafely({
    serviceRole,
    action: 'update',
    table,
    recordId: id,
    oldData: beforeRecord,
    newData: updatePayload,
    performedBy: auth.employee.id,
  });

  await updateTags(buildInvalidationTags(table));

  return NextResponse.json({ success: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withRateLimit(request, () => handlePutRequest(request, { params }));
}

async function handleDeleteRequest(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await assertAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { table: rawTable } = await params;
  const table = rawTable.toLowerCase();
  if (!OPERATIONAL_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Unknown table', code: 'API_ERROR' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  if (APPEND_ONLY_TABLES.has(table)) {
    return NextResponse.json(
      { success: false, error: { message: 'Table is append-only', code: 'FORBIDDEN' } },
      { status: 405 }
    );
  }

  const { searchParams } = request.nextUrl;
  const parsedDelete = adminDataDeleteSchema.safeParse({ id: searchParams.get('id') });
  if (!parsedDelete.success) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Missing id query parameter', code: 'VALIDATION_ERROR' },
      },
      { status: HTTP_BAD_REQUEST }
    );
  }
  const id = parsedDelete.data.id;

  const serviceRole = createServiceRoleClient();
  const beforeRecord = await fetchExistingRecord(serviceRole, { table, id });
  if (!beforeRecord) {
    return NextResponse.json(
      { success: false, error: { message: 'Record not found', code: 'NOT_FOUND' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  const mutationResult = SOFT_DELETE_OPERATIONAL_TABLES.has(table)
    ? await serviceRole
        .from(table)
        .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', id)
    : await serviceRole.from(table).delete({ count: 'exact' }).eq('id', id);
  const { count: deletedCount, error } = mutationResult;

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Delete failed', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR }
    );
  }

  if (deletedCount === 0) {
    return NextResponse.json(
      { success: false, error: { message: 'Record not found', code: 'NOT_FOUND' } },
      { status: HTTP_NOT_FOUND }
    );
  }

  await writeAuditLogSafely({
    serviceRole,
    action: 'delete',
    table,
    recordId: id,
    oldData: beforeRecord,
    performedBy: auth.employee.id,
  });

  await updateTags(buildInvalidationTags(table));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withRateLimit(request, () => handleDeleteRequest(request, { params }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withRateLimit(request, () => handleGetRequest(request, { params }));
}
