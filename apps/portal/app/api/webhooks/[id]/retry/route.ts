import crypto from 'node:crypto';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

async function handleRetry(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { employee } = principal;
  const supabase = await createServerSupabaseClient();

  const { data: webhook } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', id)
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
      const signature = crypto
        .createHmac('sha256', webhook.secret)
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
      });
      responseStatus = response.status;
      responseBody = await response.text();
      success = response.ok;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await supabase.from('webhook_delivery_logs').insert({
      webhook_endpoint_id: id,
      event_type: log.event_type,
      payload: log.payload,
      response_status: responseStatus,
      response_body: responseBody,
      delivered_at: new Date().toISOString(),
      retry_count: (log.retry_count ?? 0) + 1,
      success,
      error_message: errorMessage,
    });

    if (success) succeeded += 1;
  }

  return NextResponse.json({ success: true, retried, succeeded });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRateLimit(request, () => handleRetry(request, { params }));
}
