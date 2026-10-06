import { shiftCloseoutPayloadSchema } from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { inngest, shiftCloseoutReportEvent } from '@repo/utils/inngest';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';
import { addEvent, setAttributes, withAsyncSpan } from '@/lib/observability/tracing';

export const maxDuration = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createCloseoutMutationId(reportId: string, machineId: string, index: number): string {
  const hash = crypto
    .createHash('sha256')
    .update(`shift-closeout:${reportId}:${machineId}:${index}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hash[12] = '8';
  hash[16] = ((Number.parseInt(hash[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const hex = hash.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function POST(req: NextRequest) {
  return withAsyncSpan('api_shift_closeout', {}, async () => {
    try {
      const idempotencyKey = req.headers.get('Idempotency-Key');
      if (!idempotencyKey) {
        return NextResponse.json({ error: 'Missing Idempotency-Key header' }, { status: 400 });
      }

      const supabase = await createServerSupabaseClient();
      const principal = await getAuthenticatedEmployee(supabase);
      if (!principal) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!principal.employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 403 });
      }

      const rawBody = await req.text();
      if (new TextEncoder().encode(rawBody).byteLength > 1024 * 1024) {
        return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
      }
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

      const { employee, user } = principal;
      if (!['admin', 'operator', 'supervisor'].includes(employee.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      if (
        employee.role !== 'admin' &&
        employee.department_id !== payload.deptId &&
        !employee.accessible_departments?.includes(payload.deptId)
      ) {
        return NextResponse.json({ error: 'Department access denied' }, { status: 403 });
      }
      if (payload.idempotencyKey !== idempotencyKey) {
        return NextResponse.json({ error: 'Idempotency key mismatch' }, { status: 400 });
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

      const closeoutResult =
        isRecord(rpcResult) && rpcResult.status === 'already_closed'
          ? rpcResult.response
          : rpcResult;
      if (!isRecord(closeoutResult) || typeof closeoutResult.id !== 'string') {
        throw new Error('Shift closeout RPC returned an invalid response');
      }
      const reportId = closeoutResult.id;

      addEvent('shift_closed', {
        report_id: reportId,
        status: typeof closeoutResult.status === 'string' ? closeoutResult.status : 'closed',
      });

      if (payload.allocations.length > 0) {
        const mutations = payload.allocations.map((alloc, index) => ({
          id: createCloseoutMutationId(reportId, alloc.machine_id, index),
          hlc: { wall: Date.now(), counter: 0, node: 'server' },
          entity: 'smr',
          entityId: alloc.machine_id,
          op: 'smr.update',
          payload: {
            meterId: alloc.machine_id,
            reading: alloc.closing_smr,
            readingAt: new Date().toISOString(),
            deviceId: 'shift-closeout-form',
          },
        }));

        const { error: smrError } = await supabase.rpc('apply_offline_mutations', {
          p_tenant: payload.deptId,
          p_mutations: mutations,
        });

        if (smrError) {
          logError(smrError, { context: 'shift_closeout_smr_update', report_id: reportId });
          return NextResponse.json(
            { error: 'Shift closed, but SMR readings were not saved. Retry this request.' },
            { status: 503, headers: { 'Retry-After': '5' } }
          );
        }
      }

      await inngest.send({ name: shiftCloseoutReportEvent, data: { reportId } });
      return NextResponse.json(closeoutResult, { status: 200 });
    } catch (error: unknown) {
      logError(error, { context: 'shift_closeout_route' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
