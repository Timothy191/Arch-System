import { shiftCloseoutPayloadSchema } from '@repo/contract';
import { createServerSupabaseClient } from '@repo/supabase/server';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';
import { addEvent, setAttributes, withAsyncSpan } from '@/lib/observability/tracing';

export async function POST(req: NextRequest) {
  return withAsyncSpan('api_shift_closeout', {}, async () => {
    try {
      const idempotencyKey = req.headers.get('Idempotency-Key');
      if (!idempotencyKey) {
        return NextResponse.json({ error: 'Missing Idempotency-Key header' }, { status: 400 });
      }

      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const rawBody = await req.text();
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
      }

      const parseResult = shiftCloseoutPayloadSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid payload', details: parseResult.error.format() },
          { status: 400 }
        );
      }

      const payload = parseResult.data;
      const requestHash = crypto
        .createHash('sha256')
        .update(rawBody + payload.deptId + payload.date + payload.shift)
        .digest('hex');

      setAttributes({
        department_id: payload.deptId,
        date: payload.date,
        shift: payload.shift,
        idempotency_key: idempotencyKey,
      });

      // Role check: Only operator, supervisor, admin can close shifts
      const { data: employee } = await supabase
        .from('employees')
        .select('id, role')
        .eq('auth_id', user.id)
        .single();

      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 403 });
      }

      if (['viewer'].includes(employee.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // Execute atomic RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc('atomic_shift_closeout', {
        p_idempotency_key: idempotencyKey,
        p_user_id: user.id,
        p_route: '/api/control-room/shift-closeout',
        p_request_hash: requestHash,
        p_dept_id: payload.deptId,
        p_date: payload.date,
        p_shift: payload.shift,
        p_operator_name: payload.operatorName,
        p_alarm_response_avg: payload.alarmResponseAvgSeconds,
        p_incident_ack_avg: payload.incidentAckAvgSeconds,
        p_uptime_percent: payload.systemUptimePercent,
        p_missed_count: payload.missedIncidentsCount,
        p_summary: payload.summaryNotes,
        p_checklist: payload.checklistItems,
        p_completed_count: payload.checklistItems.filter((i) => i.status === 'completed').length,
        p_total_count: payload.checklistItems.length,
        p_supervisor_signature: payload.supervisorSignature,
        p_employee_id: employee.id,
      });

      if (rpcError) {
        if (rpcError.message.includes('conflict')) {
          return NextResponse.json({ error: 'Idempotency conflict' }, { status: 409 });
        }
        if (rpcError.message.includes('unique_violation')) {
          return NextResponse.json(
            { error: 'Shift is already closed for this date and time.' },
            { status: 409 }
          );
        }
        throw new Error(rpcError.message);
      }

      addEvent('shift_closed', { report_id: rpcResult.id, status: rpcResult.status });
      return NextResponse.json(rpcResult, { status: 200 });
    } catch (error: any) {
      logError(error, { context: 'shift_closeout_route' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
