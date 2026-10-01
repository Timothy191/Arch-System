import { SubagentCoordinator } from '@repo/agents';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { inngest, shiftCloseoutReportEvent } from '@repo/utils/inngest';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

export const shiftCloseoutReportFn = inngest.createFunction(
  { id: 'shift-closeout-report', triggers: [{ event: shiftCloseoutReportEvent }] },
  async ({ event }) => {
    const { reportId } = event.data;
    const supabase = await createServerSupabaseClient();
    const start = performance.now();
    let success = true;

    try {
      // 1. Fetch the raw shift report
      const { data: report, error } = await supabase
        .from('control_room_shift_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error || !report) {
        throw new Error(`Failed to fetch shift report: ${error?.message}`);
      }

      // 2. Format the raw data for AI summary
      const rawContext = `
        Shift Date: ${report.report_date}
        Shift Type: ${report.shift_type}
        Operator: ${report.operator_name}
        KPIs:
        - Alarm Response Avg: ${report.alarm_response_avg_seconds}s
        - Incident Ack Avg: ${report.incident_ack_avg_seconds}s
        - System Uptime: ${report.system_uptime_percent}%
        - Missed Incidents: ${report.missed_incidents_count}
        Checklist Completed: ${report.completed_checklist_count}/${report.total_checklist_count}
        Original Notes: ${report.summary_notes}
      `;

      // 3. AI-Driven Shift Summary (LLM Offload)
      let aiSummary = report.summary_notes || 'No summary available.';
      try {
        const coordinator = new SubagentCoordinator();
        aiSummary = await coordinator.run(
          'Summarize the shift report into a clear, professional executive summary paragraph suitable for management.',
          [
            {
              id: 'generate-summary',
              specialistRole: 'Executive Summarizer',
              instructions:
                'Review the shift KPIs and notes, and write a single 3-4 sentence professional executive summary of the shift performance. Do not include introductory or concluding filler. Start directly with the summary.',
              workspaceContext: rawContext,
              expectation: 'A single concise paragraph.',
            },
          ]
        );
      } catch (aiErr) {
        logError(aiErr instanceof Error ? aiErr : new Error(String(aiErr)), {
          context: 'ai_shift_summary_fallback',
        });
        aiSummary = `(Auto-Summary unavailable) ${report.summary_notes || ''}`;
      }

      // 4. Generate PDF Report
      const { pdf } = await import('@react-pdf/renderer');
      const { ReportTemplate } = await import('@/features/analytics/components/ReportTemplate');
      const React = await import('react');

      const reportData = {
        title: `Shift Closeout Report: ${report.shift_type.toUpperCase()}`,
        subtitle: `Date: ${report.report_date} | Operator: ${report.operator_name}`,
        kpis: [
          { label: 'Uptime', value: `${report.system_uptime_percent}%` },
          { label: 'Alarm Resp. Avg', value: `${report.alarm_response_avg_seconds}s` },
          { label: 'Incident Ack Avg', value: `${report.incident_ack_avg_seconds}s` },
          {
            label: 'Checklist Score',
            value: `${report.completed_checklist_count}/${report.total_checklist_count}`,
          },
        ],
        tableHeaders: ['Metric', 'Value'],
        tableRows: [
          ['Missed Incidents', String(report.missed_incidents_count)],
          ['Executive Summary', aiSummary],
        ],
      };

      const doc = React.createElement(ReportTemplate, { data: reportData });
      const buffer = await pdf(doc as any).toBuffer();

      const filename = `shift-reports/${report.department_id}/${report.report_date}_${report.shift_type}_${reportId}.pdf`;

      // 5. Upload PDF to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filename, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Optionally update the DB row to attach the AI summary and PDF path
      await supabase
        .from('control_room_shift_reports')
        .update({ summary_notes: aiSummary })
        .eq('id', reportId);

      return { success: true, filename, aiSummary };
    } catch (err) {
      success = false;
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: 'shift_closeout_report_job',
        reportId,
      });
      throw err;
    } finally {
      recordJobExecution('shift-closeout-report', performance.now() - start, success);
    }
  }
);
