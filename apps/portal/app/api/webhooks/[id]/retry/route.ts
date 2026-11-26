import crypto from 'node:crypto';
import { uuidSchema } from '@repo/contract/schemas/common.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { type NextRequest, NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { decryptWebhookSecret } from '@/lib/integrations/crypto';
import { assertSafeResolvedUrl } from '@/lib/integrations/ssrf-guard';

const MAX_RETRY_BODY_BYTES = 65_536;
const RETRY_TIMEOUT_MS = 10_000;

async function handleRetry(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!principal.employee) {
    return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
  }
  const { employee } = principal;
  if (employee.role !== 'admin' && employee.role !== 'supervisor') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid webhook ID' }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const serviceClient = createServiceRoleClient();

  const { data: webhook } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!webhook) {
    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  }

  if (
    employee.role !== 'admin' &&
    webhook.department_id !== employee.department_id &&
    !employee.accessible_departments?.includes(webhook.department_id)
  ) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    await assertSafeResolvedUrl(webhook.url);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid webhook target URL',
      },
      { status: 400 }
    );
  }

  const { data: failedLogs } = await supabase
    .from('webhook_delivery_logs')
    .select('*')
    .eq('webhook_endpoint_id', id)
    .eq('success', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!failedLogs || failedLogs.length === 0) {
    return NextResponse.json({
      success: true,
      retried: 0,
      message: 'No failed deliveries to retry',
    });
  }

  let retried = 0;
  let succeeded = 0;
  for (const log of failedLogs) {
    retried += 1;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (webhook.secret) {
      const plaintextSecret = decryptWebhookSecret(webhook.secret);
      const signature = crypto
        .createHmac('sha256', plaintextSecret)
        .update(JSON.stringify(log.payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(log.payload),
        redirect: 'manual',
        signal: AbortSignal.timeout(RETRY_TIMEOUT_MS),
      });
      responseStatus = response.status;
      responseBody = await response.text();
      success = response.ok;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const { error: updateError } = await serviceClient
      .from('webhook_delivery_logs')
      .update({
        response_status: responseStatus,
        response_body: responseBody,
        delivered_at: new Date().toISOString(),
        retry_count: (log.retry_count ?? 0) + 1,
        success,
        error_message: errorMessage,
      })
      .eq('id', log.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist webhook retry status' },
        { status: 500 }
      );
    }

    if (success) succeeded += 1;
  }

  return NextResponse.json({ success: true, retried, succeeded });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = await withRateLimit(request, () =>
    withBodyLimit(request, () => handleRetry(request, { params }), {
      maxSize: MAX_RETRY_BODY_BYTES,
    })
  );
  return applyCors(request, response);
}
