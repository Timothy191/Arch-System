'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { Clock, Cpu, Download, Edit3, Printer } from 'lucide-react';
import Image from 'next/image';
import type { CardPrintJob, EmployeeCardProfile, Neo300Printer } from './actions';

interface Neo300PrinterQueuePanelProps {
  selectedEmp: EmployeeCardProfile | null;
  printer: Neo300Printer;
  jobs: CardPrintJob[];
  isPending: boolean;
  onEditEmployee: (emp: EmployeeCardProfile) => void;
  onPrint: (employeeId: string) => void;
  onCancelJob: (jobId: string) => void;
}

const EXPIRY_DATE_SLICE_END = 10;

function formatCardExpiryDate(value: string | null | undefined): string {
  if (!value) return 'Not Set';
  const trimmed = value.trim();
  if (!trimmed) return 'Not Set';
  return trimmed.slice(0, EXPIRY_DATE_SLICE_END);
}

export function Neo300PrinterQueuePanel({
  selectedEmp,
  printer,
  jobs,
  isPending,
  onEditEmployee,
  onPrint,
  onCancelJob,
}: Neo300PrinterQueuePanelProps) {
  const isMedicalValid = Boolean(
    selectedEmp?.medical_expiry && new Date(selectedEmp.medical_expiry) > new Date()
  );
  const isInductionValid = Boolean(
    selectedEmp?.induction_expiry && new Date(selectedEmp.induction_expiry) > new Date()
  );
  const medicalDateText = formatCardExpiryDate(selectedEmp?.medical_expiry);
  const inductionDateText = formatCardExpiryDate(selectedEmp?.induction_expiry);
  const resolvedCoyNumber = selectedEmp?.coy_number || selectedEmp?.emp_code || '';

  return (
    <div className="space-y-4 lg:col-span-7">
      <GlassCard className="flex flex-col items-center border border-[var(--border-default)] p-6">
        <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2 border-[var(--border-default)] border-b pb-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
              <Cpu className="h-4 w-4 text-emerald-600" />
              CR80 PVC Card Preview (ISO/IEC 7810 ID-1 Standard)
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Standard format 85.60 mm × 53.98 mm • Optimized for Neo 300 Dye-Sublimation
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedEmp && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEditEmployee(selectedEmp)}
                className="h-7 gap-1.5 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Photo &amp; Details
              </Button>
            )}
            <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 text-xs">
              Plantcor Card • Front
            </span>
          </div>
        </div>

        {selectedEmp ? (
          <div className="flex w-full flex-col items-center gap-6">
            <div className="relative h-[240px] w-[380px] select-none overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-md">
              <Image
                src="/images/access-card-template.jpeg"
                alt="Plantcor Pty Ltd Access Card Template"
                fill
                sizes="380px"
                className="object-cover"
              />
              <span className="absolute top-[69px] left-[55px] font-bold text-[10px] text-slate-900">
                {selectedEmp.first_name} {selectedEmp.surname}
              </span>
              <span className="absolute top-[69px] left-[180px] font-mono font-semibold text-[10px] text-slate-900">
                {selectedEmp.id_number || 'Verified'}
              </span>
              <span className="absolute top-[128px] left-[55px] font-semibold text-[10px] text-slate-900">
                {selectedEmp.job_title || 'Site Operator'}
              </span>
              <span
                data-testid="plantcor-card-coy-number"
                className="absolute top-[148px] left-[295px] font-bold font-mono text-[10px] text-slate-900"
              >
                {resolvedCoyNumber}
              </span>
              <span
                data-testid="plantcor-card-medical-date"
                className={`absolute top-[181px] left-[55px] font-mono font-semibold text-[10px] ${
                  isMedicalValid ? 'text-slate-900' : 'text-red-700'
                }`}
              >
                {medicalDateText}
              </span>
              <span
                data-testid="plantcor-card-induction-date"
                className={`absolute top-[181px] left-[190px] font-mono font-semibold text-[10px] ${
                  isInductionValid ? 'text-slate-900' : 'text-amber-700'
                }`}
              >
                {inductionDateText}
              </span>
            </div>

            {/* Print Dispatch Action Button */}
            <div className="flex w-full max-w-[380px] flex-wrap items-center gap-3">
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500"
                onClick={() => onPrint(selectedEmp.id)}
                disabled={isPending}
              >
                <Printer className="h-4 w-4" />
                {isPending ? 'Sending to Neo 300...' : 'Print Card via Neo 300'}
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => onEditEmployee(selectedEmp)}
              >
                <Edit3 className="h-4 w-4" />
                Setup
              </Button>

              <Button
                variant="outline"
                className="gap-2 print:hidden"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.print();
                  }
                }}
              >
                <Download className="h-4 w-4" />
                Print / PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm">
            Select an employee from the directory or click &ldquo;+ Add Employee to DB&rdquo; to
            preview and print their PVC ID badge.
          </div>
        )}
      </GlassCard>

      {/* ── Print Queue / Recent Jobs Table ── */}
      <GlassCard className="space-y-3 border border-[var(--border-default)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm">
            <Clock className="h-4 w-4 text-blue-600" />
            Neo 300 Print Queue &amp; Recent Dispatches
          </h3>
          <span className="text-[var(--text-muted)] text-xs">{jobs.length} jobs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-[var(--border-default)] border-b text-[var(--text-muted)]">
                <th className="pb-2 font-medium">Job ID</th>
                <th className="pb-2 font-medium">Employee Name</th>
                <th className="pb-2 font-medium">Target Printer</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]/50">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-[var(--bg-secondary)]/30">
                  <td className="py-2.5 font-mono text-[var(--text-muted)]">
                    #{j.id.substring(0, 8)}
                  </td>
                  <td className="py-2.5 font-medium text-[var(--text-primary)]">
                    {j.employee_name}
                  </td>
                  <td className="py-2.5 text-[var(--text-secondary)]">{printer.model}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[10px] ${
                        j.status === 'completed'
                          ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
                          : j.status === 'queued' || j.status === 'printing'
                            ? 'animate-pulse border border-blue-500/25 bg-blue-500/10 text-blue-700'
                            : 'border border-slate-500/25 bg-slate-500/10 text-slate-700'
                      }`}
                    >
                      {j.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 text-[var(--text-secondary)]">
                    {new Date(j.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 text-right">
                    {j.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => onCancelJob(j.id)}
                        className="font-medium text-red-600 text-xs hover:text-red-500"
                      >
                        Cancel
                      </button>
                    )}
                    {j.status === 'completed' && j.personnel_id && (
                      <button
                        type="button"
                        onClick={() => onPrint(j.personnel_id!)}
                        className="font-medium text-blue-600 text-xs hover:text-blue-500"
                      >
                        Reprint
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                    No print jobs in history. Select an employee to print.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
