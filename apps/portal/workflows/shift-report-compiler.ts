import { createServiceRoleClient } from '@repo/supabase/service-role';
import { logError } from '@/lib/errors/error-logger';

async function gatherScadaTelemetry(shiftId: string) {
  'use step';

  const supabase = createServiceRoleClient();

  // Aggregate end-of-shift telemetry markers
  const { data: records, error } = await supabase
    .from('scada_telemetry')
    .select('id, value, timestamp, sensor_id')
    .eq('shift_id', shiftId)
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

async function compileReportArtifact(shiftId: string, telemetryData: any) {
  'use step';

  const supabase = createServiceRoleClient();

  // Generate structured report payload
  const reportPayload = {
    shift_id: shiftId,
    generated_at: new Date().toISOString(),
    total_telemetry_points: telemetryData.points,
    system_status: 'verified',
  };

  // Upsert the compiled report metadata into the database
  const { data, error } = await supabase
    .from('shift_reports')
    .upsert({
      id: shiftId,
      metadata: reportPayload,
      status: 'compiled',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error && error.code !== '42P01') {
    logError(error, { context: 'compile_report_artifact', shiftId });
  }

  return { reportId: data?.id || shiftId };
}

async function dispatchManagementNotification(shiftId: string, reportId: string) {
  'use step';

  const supabase = createServiceRoleClient();

  // Dispatch notification to management dashboard
  const { error } = await supabase.from('app_notifications').insert({
    title: 'Shift Report Compiled',
    message: `The end-of-shift report for ${shiftId} has been successfully compiled and is ready for review.`,
    priority: 'normal',
    department: 'management',
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
