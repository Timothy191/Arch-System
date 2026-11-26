/**
 * @swagger
 * /api/webhooks/{id}:
 *   put:
 *     summary: Update webhook endpoint
 *     description: Update an existing webhook endpoint. All fields are optional - only provided fields will be updated. Non-admins can only update webhooks for their department.
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook endpoint ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: New webhook URL
 *               description:
 *                 type: string
 *                 description: New webhook description
 *               event_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [daily_log.created, daily_log.updated, breakdown.created, breakdown.updated, breakdown.completed, production_log.created, production_log.updated, operational_delay.created, operational_delay.updated]
 *                 description: Event types to subscribe to
 *               active:
 *                 type: boolean
 *                 description: Whether the webhook is active
 *     responses:
 *       200:
 *         description: Webhook updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webhook:
 *                   type: object
 *                   description: Updated webhook endpoint
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Webhook not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete webhook endpoint
 *     description: Soft delete a webhook endpoint (sets deleted_at timestamp). Non-admins can only delete webhooks for their department.
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook endpoint ID
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Webhook not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */

import { uuidSchema } from '@repo/contract/schemas/common.schema';
import { updateWebhookSchema } from '@repo/contract/schemas/webhook.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
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

import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { validateBody } from '@/lib/api/response';

const MAX_WEBHOOK_BODY_BYTES = 524_288;

async function handleGetWebhook(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
  const { employee } = principal;
  if (employee.role !== 'admin' && employee.role !== 'supervisor') {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
      { status: 403 }
    );
  }
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid webhook ID', code: 'VALIDATION_ERROR' } },
      { status: 400 }
    );
  }
  const supabase = await createServerSupabaseClient();

  const { data: webhook } = await supabase
    .from('webhook_endpoints')
    .select(SAFE_WEBHOOK_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!webhook) {
    return NextResponse.json(
      { success: false, error: { message: 'Webhook not found', code: 'API_ERROR' } },
      { status: 404 }
    );
  }

  if (
    employee.role !== 'admin' &&
    webhook.department_id !== employee.department_id &&
    !employee.accessible_departments?.includes(webhook.department_id)
  ) {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
      { status: 403 }
    );
  }

  return NextResponse.json({ webhook: redactWebhookRow(webhook as Record<string, unknown>) });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () => handleGetWebhook(request, { params }));
  return applyCors(request, response);
}

async function handlePutWebhook(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
  const { employee } = principal;
  if (employee.role !== 'admin' && employee.role !== 'supervisor') {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
      { status: 403 }
    );
  }
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid webhook ID', code: 'VALIDATION_ERROR' } },
      { status: 400 }
    );
  }

  const parsed = await validateBody(request, updateWebhookSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { url, description, event_types, active, secret } = parsed.data;

  if (url !== undefined) {
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
  }

  const supabase = await createServerSupabaseClient();

  // Get the webhook to check ownership
  const { data: existingWebhook } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existingWebhook) {
    return NextResponse.json(
      { success: false, error: { message: 'Webhook not found', code: 'API_ERROR' } },
      { status: 404 }
    );
  }

  // Check if user has permission to update this webhook
  if (employee.role !== 'admin') {
    if (
      existingWebhook.department_id !== employee.department_id &&
      !employee.accessible_departments?.includes(existingWebhook.department_id)
    ) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
        { status: 403 }
      );
    }
  }

  const encryptedSecret = secret !== undefined ? encryptWebhookSecret(secret) : undefined;
  const { data: webhook, error } = await supabase
    .from('webhook_endpoints')
    .update({
      ...(url !== undefined && { url }),
      ...(description !== undefined && { description }),
      ...(event_types !== undefined && { event_types }),
      ...(active !== undefined && { active }),
      ...(encryptedSecret !== undefined && { secret: encryptedSecret }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select(SAFE_WEBHOOK_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update webhook', code: 'API_ERROR' } },
      { status: 500 }
    );
  }

  revalidatePath('/admin');
  revalidatePath('/(departments)/[department]/tools');

  return NextResponse.json({ webhook: redactWebhookRow(webhook as Record<string, unknown>) });
}

// PUT /api/webhooks/[id] - Update a webhook endpoint
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () =>
    withBodyLimit(request, () => handlePutWebhook(request, { params }), {
      maxSize: MAX_WEBHOOK_BODY_BYTES,
    })
  );
  return applyCors(request, response);
}

async function handleDeleteWebhook(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
  const { employee } = principal;

  const supabase = await createServerSupabaseClient();

  // Get the webhook to check ownership
  const { data: existingWebhook } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existingWebhook) {
    return NextResponse.json(
      { success: false, error: { message: 'Webhook not found', code: 'API_ERROR' } },
      { status: 404 }
    );
  }

  // Check if user has permission to delete this webhook
  if (employee.role !== 'admin') {
    if (
      existingWebhook.department_id !== employee.department_id &&
      !employee.accessible_departments?.includes(existingWebhook.department_id)
    ) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'API_ERROR' } },
        { status: 403 }
      );
    }
  }

  // Soft delete
  const { error } = await supabase
    .from('webhook_endpoints')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete webhook', code: 'API_ERROR' } },
      { status: 500 }
    );
  }

  revalidatePath('/admin');
  revalidatePath('/(departments)/[department]/tools');

  return NextResponse.json({ success: true });
}

// DELETE /api/webhooks/[id] - Delete a webhook endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const response = await withRateLimit(request, () => handleDeleteWebhook(request, { params }));
  return applyCors(request, response);
}
