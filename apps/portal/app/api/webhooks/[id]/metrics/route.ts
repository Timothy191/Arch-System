import { uuidSchema } from '@repo/contract/schemas/common.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

async function handleMetrics(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: webhook } = await supabase
    .from('webhook_endpoints')
    .select('department_id')
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

  const { data: logs, error: logsError } = await supabase
    .from('webhook_delivery_logs')
    .select('success, created_at, retry_count')
    .eq('webhook_endpoint_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) {
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }

  const deliveryLogs = logs ?? [];
  const total = deliveryLogs.length;
  const successful = deliveryLogs.filter((log) => log.success).length;
  const failed = total - successful;
  const retried = deliveryLogs.filter((log) => (log.retry_count ?? 0) > 0).length;

  return NextResponse.json({
    success: true,
    total,
    successful,
    failed,
    retried,
    successRate: total === 0 ? 0 : Math.round((successful / total) * 100),
    lastDeliveredAt: deliveryLogs.find((log) => log.success)?.created_at ?? null,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRateLimit(request, () => handleMetrics(request, { params }));
}
