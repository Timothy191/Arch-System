/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: List webhook endpoints
 *     description: Retrieve all webhook endpoints. Admins can see all webhooks, supervisors only see webhooks for their department.
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of webhook endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhooks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Webhook endpoint ID
 *                       url:
 *                         type: string
 *                         description: Webhook URL
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         description: Webhook description
 *                       event_types:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [daily_log.created, daily_log.updated, breakdown.created, breakdown.updated, breakdown.completed, production_log.created, production_log.updated, operational_delay.created, operational_delay.updated]
 *                       department_id:
 *                         type: string
 *                         nullable: true
 *                       active:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       429:
 *         description: Rate limit exceeded
 *   post:
 *     summary: Create webhook endpoint
 *     description: Create a new webhook endpoint for receiving event notifications. Non-admins can only create webhooks for their department.
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - event_types
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook endpoint URL
 *               description:
 *                 type: string
 *                 description: Webhook description
 *               event_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [daily_log.created, daily_log.updated, breakdown.created, breakdown.updated, breakdown.completed, production_log.created, production_log.updated, operational_delay.created, operational_delay.updated]
 *                 description: Event types to subscribe to
 *               department_id:
 *                 type: string
 *                 description: Department ID (defaults to user's department if not provided)
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhook:
 *                   type: object
 *                   description: Created webhook endpoint
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */

import { createWebhookSchema } from '@repo/contract/schemas/webhook.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';
import { encryptWebhookSecret } from '@/lib/integrations/crypto';
import { assertSafeResolvedUrl } from '@/lib/integrations/ssrf-guard';

const SAFE_WEBHOOK_COLUMNS =
  'id, url, description, event_types, department_id, active, created_at, updated_at, secret';

function redactWebhookRow(row: Record<string, unknown>) {
  const { secret, ...safeFields } = row;
  return {
    ...safeFields,
    has_secret: Boolean(secret),
  };
}

type WebhookEventType =
  | 'daily_log.created'
  | 'daily_log.updated'
  | 'breakdown.created'
  | 'breakdown.updated'
  | 'breakdown.completed'
  | 'production_log.created'
  | 'production_log.updated'
  | 'operational_delay.created'
  | 'operational_delay.updated';

interface _WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  event_types: WebhookEventType[];
  department_id: string | null;
  active: boolean;
  secret: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

async function handleGetWebhooks(_request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal)
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
      { status: 401 }
    );
  if (!principal.employee) {
    return NextResponse.json(
      { success: false, error: { message: 'Employee not found', code: 'API_ERROR' } },
      { status: 404 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { employee } = principal;
  if (employee.role !== 'admin' && employee.role !== 'supervisor') {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
      { status: 403 }
    );
  }

  // Admins can see all webhooks, supervisors only their department's
  let query = supabase
    .from('webhook_endpoints')
    .select(SAFE_WEBHOOK_COLUMNS)
    .is('deleted_at', null);

  if (employee.role !== 'admin') {
    const accessibleDepartments = (employee.accessible_departments ?? []).filter(
      (deptId): deptId is string => typeof deptId === 'string' && deptId.trim().length > 0
    );
    if (accessibleDepartments.length > 0 && employee.department_id) {
      query = query.or(
        `department_id.eq.${employee.department_id},department_id.in.(${accessibleDepartments.join(',')})`
      );
    } else if (accessibleDepartments.length > 0) {
      query = query.in('department_id', accessibleDepartments);
    } else if (employee.department_id) {
      query = query.eq('department_id', employee.department_id);
    } else {
      return NextResponse.json({ webhooks: [] });
    }
  }

  const { data: webhooks, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Database query failed', code: 'API_ERROR' } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    webhooks: (webhooks ?? []).map((row) => redactWebhookRow(row as Record<string, unknown>)),
  });
}

// GET /api/webhooks - List all webhook endpoints
export async function GET(request: NextRequest) {
  const response = await withRateLimit(request, () => handleGetWebhooks(request));
  return applyCors(request, response);
}

async function handleCreateWebhook(request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal)
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
      { status: 401 }
    );
  if (!principal.employee) {
    return NextResponse.json(
      { success: false, error: { message: 'Employee not found', code: 'API_ERROR' } },
      { status: 404 }
    );
  }

  const parsed = await validateBody(request, createWebhookSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { url, description, event_types, department_id, secret, active } = parsed.data;

  try {
    await assertSafeResolvedUrl(url);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Invalid webhook URL',
          code: 'API_ERROR',
        },
      },
      { status: 400 }
    );
  }

  const { employee } = principal;
  if (employee.role !== 'admin' && employee.role !== 'supervisor') {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
      { status: 403 }
    );
  }

  // Non-admins can only create webhooks for their department
  if (employee.role !== 'admin') {
    const targetDept = department_id || employee.department_id;
    if (
      targetDept !== employee.department_id &&
      !employee.accessible_departments?.includes(targetDept)
    ) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
        { status: 403 }
      );
    }
  }

  const encryptedSecret = secret !== undefined ? encryptWebhookSecret(secret) : undefined;
  const supabase = await createServerSupabaseClient();
  const { data: webhook, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      url,
      description,
      event_types,
      department_id: department_id || employee.department_id,
      active: active ?? true,
      ...(encryptedSecret !== undefined ? { secret: encryptedSecret } : {}),
    })
    .select(SAFE_WEBHOOK_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create webhook', code: 'API_ERROR' } },
      { status: 500 }
    );
  }

  revalidatePath('/admin');
  revalidatePath('/(departments)/[department]/tools');

  return NextResponse.json(
    { webhook: redactWebhookRow(webhook as Record<string, unknown>) },
    { status: 201 }
  );
}

// POST /api/webhooks - Create a new webhook endpoint
export async function POST(request: NextRequest) {
  const response = await withRateLimit(request, () =>
    withBodyLimit(request, () => handleCreateWebhook(request), {
      maxSize: 524288,
    })
  );
  return applyCors(request, response);
}
