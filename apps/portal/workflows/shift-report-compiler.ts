import { createServiceRoleClient } from '@repo/supabase/service-role';
import { logError } from '@/lib/errors/error-logger';

interface TelemetrySummaryStepResult {
  status: string;
  points: number;
}

async function gatherScadaTelemetry(shiftId: string): Promise<TelemetrySummaryStepResult> {
  'use step';

  const supabase = createServiceRoleClient();

  // Aggregate end-of-shift telemetry markers from canonical public.machine_telemetry
  const { data: records, error } = await supabase
    .from('machine_telemetry')
    .select('id, value, timestamp, metric_type')
    .order('timestamp', { ascending: false })
    .limit(10000);

  if (error) {
    if (error.code !== '42P01') {
      logError(error, { context: 'gather_scada_telemetry_step', shiftId });
    }
    return { points: 0, status: 'no_data' };
  }

  return {
    status: 'aggregated',
    points: records?.length || 0,
  };
}

async function compileReportArtifact(
  shiftId: string,
  telemetryData: TelemetrySummaryStepResult
): Promise<{ reportId: string }> {
  'use step';

  const supabase = createServiceRoleClient();
  const reportDate = new Date().toISOString().split('T')[0]!;

  // Upsert the compiled report metadata into canonical public.control_room_shift_reports
  const { data, error } = await supabase
    .from('control_room_shift_reports')
    .upsert(
      {
        report_date: reportDate,
        shift_type: 'day',
        operator_name: 'Automated Shift Compiler',
        summary_notes: `Compiled shift ${shiftId} with ${telemetryData.points} telemetry points (${telemetryData.status}).`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'department_id,report_date,shift_type' }
    )
    .select('id')
    .maybeSingle();

  if (error && error.code !== '42P01') {
    logError(error, { context: 'compile_report_artifact', shiftId });
  }

  return { reportId: (data as { id?: string } | null)?.id || shiftId };
}

async function dispatchManagementNotification(shiftId: string, reportId: string) {
  'use step';

  const supabase = createServiceRoleClient();

  // Record compiled shift report event into canonical public.audit_logs
  const { error } = await supabase.from('audit_logs').insert({
    action: 'SHIFT_REPORT_COMPILED',
    entity_type: 'control_room_shift_reports',
    entity_id: reportId,
    new_values: {
      shift_id: shiftId,
      report_id: reportId,
      title: 'Shift Report Compiled',
      message: `The end-of-shift report for ${shiftId} has been compiled and is ready for review.`,
      department: 'management',
    },
  });

  if (error && error.code !== '42P01') {
    logError(error, { context: 'dispatch_management_notification', shiftId });
  }

  return { dispatched: true };
}

export async function handleShiftReport(shiftId: string) {
  'use workflow';

  const telemetry = await gatherScadaTelemetry(shiftId);
  const artifact = await compileReportArtifact(shiftId, telemetry);
  await dispatchManagementNotification(shiftId, artifact.reportId);

  return { status: 'success', shiftId };
}
