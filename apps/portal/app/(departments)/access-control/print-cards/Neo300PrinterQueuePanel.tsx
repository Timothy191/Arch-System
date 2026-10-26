'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Clock,
  Cpu,
  Download,
  Edit3,
  FileCheck2,
  Printer,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSection } from '../card-actions/qr-section';
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

export function Neo300PrinterQueuePanel({
  selectedEmp,
  printer,
  jobs,
  isPending,
  onEditEmployee,
  onPrint,
  onCancelJob,
}: Neo300PrinterQueuePanelProps) {
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

  const isMedicalValid =
    selectedEmp?.medical_expiry && new Date(selectedEmp.medical_expiry) > new Date();
  const isInductionValid =
    selectedEmp?.induction_expiry && new Date(selectedEmp.induction_expiry) > new Date();

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
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-1">
              <button
                type="button"
                onClick={() => setCardSide('front')}
                className={`rounded px-3 py-1 font-medium text-xs transition-colors ${
                  cardSide === 'front'
                    ? 'bg-blue-600 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setCardSide('back')}
                className={`rounded px-3 py-1 font-medium text-xs transition-colors ${
                  cardSide === 'back'
                    ? 'bg-blue-600 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Back
              </button>
            </div>
          </div>
        </div>

        {selectedEmp ? (
          <div className="flex w-full flex-col items-center gap-6">
            {/* ── Card Canvas (Realistic CR80 Styling) ── */}
            <div className="relative h-[240px] w-[380px] select-none overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 text-white shadow-2xl transition-all">
              {/* Holographic Security Overlay Pattern */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] opacity-10 [background-size:12px_12px]" />
              <div className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />

              {cardSide === 'front' ? (
                <div className="relative flex h-full flex-col justify-between">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-white/15 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 font-bold text-white text-xs shadow-sm">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="bg-gradient-to-r from-blue-200 to-indigo-100 bg-clip-text font-extrabold text-transparent text-xs uppercase tracking-wider">
                          PLANTCOR MINING
                        </span>
                        <span className="block font-mono text-[8px] text-blue-300 tracking-widest">
                          SITE ACCESS CLEARANCE
                        </span>
                      </div>
                    </div>

                    <span className="rounded border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-300">
                      {selectedEmp.emp_code}
                    </span>
                  </div>

                  {/* Card Body: Photo & Identity */}
                  <div className="my-auto flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onEditEmployee(selectedEmp)}
                      title="Click to upload or update employee photo"
                      className="relative flex h-24 w-20 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-white/30 bg-slate-800 shadow-inner hover:border-blue-400"
                    >
                      {selectedEmp.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedEmp.photo_url}
                          alt={`${selectedEmp.first_name} ${selectedEmp.surname}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          <span className="font-bold text-2xl text-slate-300">
                            {selectedEmp.first_name[0]}
                            {selectedEmp.surname[0]}
                          </span>
                          <span className="mt-1 text-[7px] text-blue-300 uppercase tracking-wider">
                            + ADD PHOTO
                          </span>
                        </>
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="truncate font-bold text-base text-white leading-tight">
                        {selectedEmp.first_name} {selectedEmp.surname}
                      </h4>
                      <p className="truncate font-medium text-blue-200 text-xs">
                        {selectedEmp.job_title || 'Site Operator'}
                      </p>
                      <p className="font-mono text-[10px] text-slate-300">
                        NAT ID: {selectedEmp.id_number || 'Verified'}
                      </p>

                      <div className="flex items-center gap-2 pt-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-[9px] ${
                            isMedicalValid
                              ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                              : 'border-red-400/30 bg-red-500/20 text-red-300'
                          }`}
                        >
                          <Stethoscope className="h-2.5 w-2.5" />
                          Med: {isMedicalValid ? 'PASS' : 'EXP'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium text-[9px] ${
                            isInductionValid
                              ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                              : 'border-amber-400/30 bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          <FileCheck2 className="h-2.5 w-2.5" />
                          Induct: {isInductionValid ? 'OK' : 'DUE'}
                        </span>
                      </div>
                    </div>

                    {/* QR Code section */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-md">
                      <QRCodeSection
                        data={selectedEmp.qr_code || `EMP-${selectedEmp.emp_code}`}
                        size={56}
                      />
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-white/10 border-t pt-1 font-mono text-[8px] text-slate-300">
                    <span>DEPT: {selectedEmp.department_name?.toUpperCase()}</span>
                    <span>{selectedEmp.area?.toUpperCase() || 'MAIN COMPLEX'} • RFID</span>
                  </div>
                </div>
              ) : (
                /* Back of Card Preview */
                <div className="relative flex h-full flex-col justify-between py-1">
                  {/* Magnetic Stripe representation */}
                  <div className="-mx-5 my-1 h-8 w-full bg-black/90 px-5" />

                  <div className="space-y-2 px-1 font-mono text-[8px] text-slate-300">
                    <p className="leading-tight">
                      This credential is property of Plantcor Mining. Unauthorized possession,
                      duplication, or transfer is strictly prohibited. If found, please return to
                      the Security Access Gate.
                    </p>
                    <div className="flex items-center justify-between rounded border border-white/10 bg-black/30 p-2 text-[9px]">
                      <span>Emergency Security Hotline:</span>
                      <span className="font-bold text-white">+27 (0) 11 902 4400</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-white/10 border-t pt-2 font-mono text-[8px] text-slate-300">
                    <span>MAGICARD SECURE HOLOPRINT</span>
                    <span>SER: {selectedEmp.id.substring(0, 12).toUpperCase()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Print Dispatch Action Button */}
            <div className="flex w-full max-w-[380px] flex-wrap items-center gap-3">
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-blue-600/30 shadow-lg hover:from-blue-500 hover:to-indigo-500"
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
                className="gap-2"
                onClick={() => toast.info('PDF card preview ready for download')}
              >
                <Download className="h-4 w-4" />
                PDF
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
                    {new Date(j.created_at).toLocaleTimeString([], {
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
                    {j.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => onPrint(j.personnel_id || '')}
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
