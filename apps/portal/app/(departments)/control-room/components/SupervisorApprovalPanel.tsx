'use client';

import { GlassCard } from '@repo/ui/components/GlassCard';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface ShiftReportSummary {
  id: string;
  reportDate: string;
  shiftType: string;
  operatorName: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitterId?: string | null;
  approverId?: string | null;
  approvalNote?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

interface SupervisorApprovalPanelProps {
  reports: ShiftReportSummary[];
  currentEmployeeId?: string | null;
  currentRole?: string | null;
}

export function SupervisorApprovalPanel({
  reports: initialReports,
  currentEmployeeId,
  currentRole,
}: SupervisorApprovalPanelProps) {
  const [reports, setReports] = useState<ShiftReportSummary[]>(initialReports);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const isSupervisorOrAdmin = currentRole === 'supervisor' || currentRole === 'admin';

  if (!isSupervisorOrAdmin && reports.length === 0) {
    return null;
  }

  const handleApprove = async (reportId: string, submitterId?: string | null) => {
    if (currentEmployeeId && submitterId && currentEmployeeId === submitterId) {
      toast.error(
        'Separation of duties violation: Submitter cannot approve their own shift closeout.'
      );
      return;
    }

    setApprovingId(reportId);
    try {
      const response = await fetch('/api/control-room/shift-closeout/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          approvalNote: notes[reportId]?.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        if (data.code === 'SEPARATION_OF_DUTIES_VIOLATION') {
          toast.error(data.error || 'Submitter cannot approve their own shift closeout.');
        } else {
          toast.error(data.error || 'Failed to approve shift report.');
        }
        return;
      }

      toast.success('Shift closeout report successfully approved and locked.');
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approverId: currentEmployeeId,
                approvalNote: notes[reportId]?.trim() || r.approvalNote,
              }
            : r
        )
      );
    } catch (_err) {
      toast.error('Network error during shift approval.');
    } finally {
      setApprovingId(null);
    }
  };

  const pendingReports = reports.filter((r) => r.status === 'submitted');
  const pastReports = reports.filter((r) => r.status !== 'submitted');

  return (
    <div className="space-y-6">
      <GlassCard variant="spotlight" className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle,#e5e7eb)]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-semibold text-[var(--text-heading,#111827)]">
                Supervisor Shift Closeout Governance
              </h2>
            </div>
            <p className="text-sm text-[var(--text-secondary,#4b5563)] mt-1">
              MHSA statutory compliance & shift sign-off. Separation of duties strictly enforced:
              report submitter cannot self-approve.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Separation of Duties Active
          </span>
        </div>

        {pendingReports.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-secondary,#6b7280)] bg-[var(--bg-subtle,#f9fafb)] rounded-lg border border-dashed border-[var(--border-subtle,#e5e7eb)]">
            <Clock className="w-8 h-8 text-[var(--text-muted,#9ca3af)] mx-auto mb-2 opacity-60" />
            No shift closeout reports currently awaiting supervisor approval.
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--text-secondary,#4b5563)] uppercase">
              Pending Approvals ({pendingReports.length})
            </h3>
            {pendingReports.map((report) => {
              const isSelfSubmitter =
                Boolean(currentEmployeeId) &&
                Boolean(report.submitterId) &&
                currentEmployeeId === report.submitterId;
              const isSubmitting = approvingId === report.id;

              return (
                <div
                  key={report.id}
                  className="p-4 rounded-lg border border-[var(--border-subtle,#e5e7eb)] bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--text-heading,#111827)]">
                        {report.reportDate} — {report.shiftType.toUpperCase()} Shift
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pending Approval
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary,#4b5563)]">
                      Submitted by:{' '}
                      <span className="font-medium text-gray-900">{report.operatorName}</span>
                    </div>

                    {isSelfSubmitter && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                        <span>
                          Submitter lock: You submitted this report. An independent supervisor must
                          review and approve.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {!isSelfSubmitter && isSupervisorOrAdmin && (
                      <input
                        type="text"
                        placeholder="Optional approval note..."
                        value={notes[report.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                        }
                        className="text-xs px-3 py-1.5 rounded border border-[var(--border-subtle,#d1d5db)] bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-48"
                      />
                    )}

                    <button
                      type="button"
                      disabled={isSelfSubmitter || !isSupervisorOrAdmin || isSubmitting}
                      onClick={() => handleApprove(report.id, report.submitterId)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                        isSelfSubmitter || !isSupervisorOrAdmin
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Approving...' : 'Approve Closeout'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pastReports.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[var(--border-subtle,#e5e7eb)] space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--text-secondary,#4b5563)] uppercase">
              Recent Completed Sign-Offs
            </h3>
            <div className="space-y-2">
              {pastReports.slice(0, 5).map((report) => (
                <div
                  key={report.id}
                  className="p-3 rounded-md bg-[var(--bg-subtle,#f9fafb)] border border-[var(--border-subtle,#e5e7eb)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {report.reportDate} ({report.shiftType.toUpperCase()})
                    </span>
                    <span className="text-gray-500">— {report.operatorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Approved
                      </span>
                    )}
                    {report.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Rejected
                      </span>
                    )}
                    {report.approvedAt && (
                      <span className="text-gray-400">
                        {new Date(report.approvedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
