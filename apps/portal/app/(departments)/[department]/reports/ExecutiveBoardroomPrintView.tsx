'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import { OVERVIEW_DELAY_COLUMNS } from '@/lib/shift-sheet-buckets';
import type { MachinePredictiveMetric } from './predictive-maintenance';
import type { EngineeringLogItem, MachineMonthlySummaryRow } from './reports-types';

interface ExecutiveBoardroomPrintViewProps {
  selectedMonth: string;
  shiftType: 'day' | 'night';
  summaryRows: readonly MachineMonthlySummaryRow[];
  engineeringLogs: readonly EngineeringLogItem[];
  predictiveMetrics: readonly MachinePredictiveMetric[];
  onClose: () => void;
}

const BTN_PRIMARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 font-semibold text-white text-xs hover:opacity-90';
const BTN_SECONDARY =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-tertiary)]';

export function ExecutiveBoardroomPrintView({
  selectedMonth,
  shiftType,
  summaryRows,
  engineeringLogs,
  predictiveMetrics,
  onClose,
}: ExecutiveBoardroomPrintViewProps) {
  const monthLogs = engineeringLogs.filter((l) => l.date.startsWith(selectedMonth));
  const totalWorked = summaryRows.reduce((acc, r) => acc + r.totalSmrWorked, 0);
  const totalBreakdown = summaryRows.reduce((acc, r) => acc + (r.delays.breakdown ?? 0), 0);
  const avgAvailability =
    summaryRows.length > 0
      ? Number(
          (
            summaryRows.reduce((acc, r) => acc + r.availabilityPercent, 0) / summaryRows.length
          ).toFixed(1)
        )
      : 0;
  const avgUtilization =
    summaryRows.length > 0
      ? Number(
          (
            summaryRows.reduce((acc, r) => acc + r.utilizationPercent, 0) / summaryRows.length
          ).toFixed(1)
        )
      : 0;

  const topBottlenecks = [...predictiveMetrics]
    .sort((a, b) => b.totalBreakdownHours - a.totalBreakdownHours || a.mtbfHours - b.mtbfHours)
    .slice(0, 5);

  const upcomingServices = predictiveMetrics.filter(
    (m) =>
      m.serviceIntervalProximity.isApproaching250Service ||
      m.serviceIntervalProximity.isApproaching500Service
  );

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div
      data-testid="executive-boardroom-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl print:max-h-none print:w-full print:p-4 print:shadow-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-500/15 px-2.5 py-1 font-bold text-[11px] text-amber-900 uppercase">
              Boardroom Executive One-Pager
            </span>
            <span className="text-[var(--text-secondary)] text-xs">
              Formatted for Board &amp; C-Suite Print or PDF Export
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              data-testid="boardroom-print-action-btn"
              className={BTN_PRIMARY}
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="close-boardroom-modal-btn"
              className={BTN_SECONDARY}
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>

        {/* Printable Executive Document Header */}
        <div className="border-black border-b-2 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[11px] text-gray-500 uppercase tracking-wider">
                Arch Mining Operations · Executive Summary
              </div>
              <h1 className="mt-1 font-black text-2xl text-gray-900 tracking-tight">
                Monthly Fleet Operational &amp; Reliability Report
              </h1>
              <p className="mt-0.5 text-gray-600 text-xs">
                Period: <strong>{selectedMonth}</strong> · Shift Scope:{' '}
                <strong>{shiftType.toUpperCase()} SHIFT</strong> · Generated:{' '}
                {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-300 p-2.5 text-right font-mono text-[10px]">
              <div>
                STATUS: <strong>SEALED EXECUTIVE RECORD</strong>
              </div>
              <div>
                FLEET COUNT: <strong>{summaryRows.length} UNITS</strong>
              </div>
              <div>
                CLASSIFICATION: <strong>CONFIDENTIAL</strong>
              </div>
            </div>
          </div>

          {/* 4 Core Executive Metric Cards */}
          <div className="mt-4 grid grid-cols-4 gap-3 text-center">
            <div className="rounded-xl border border-gray-300 bg-gray-50 p-2.5">
              <div className="font-semibold text-[10px] text-gray-500 uppercase">
                Fleet Availability
              </div>
              <div className="font-bold font-mono text-2xl text-emerald-700">
                {avgAvailability}%
              </div>
              <div className="text-[10px] text-gray-500">Benchmark: 85.0%</div>
            </div>

            <div className="rounded-xl border border-gray-300 bg-gray-50 p-2.5">
              <div className="font-semibold text-[10px] text-gray-500 uppercase">
                Fleet Utilization
              </div>
              <div className="font-bold font-mono text-2xl text-sky-700">{avgUtilization}%</div>
              <div className="text-[10px] text-gray-500">Benchmark: 75.0%</div>
            </div>

            <div className="rounded-xl border border-gray-300 bg-gray-50 p-2.5">
              <div className="font-semibold text-[10px] text-gray-500 uppercase">
                Total Worked SMR
              </div>
              <div className="font-bold font-mono text-2xl text-gray-900">
                {totalWorked.toFixed(1)} h
              </div>
              <div className="text-[10px] text-gray-500">Actual Engine Hours</div>
            </div>

            <div className="rounded-xl border border-gray-300 bg-gray-50 p-2.5">
              <div className="font-semibold text-[10px] text-gray-500 uppercase">
                Breakdown Loss
              </div>
              <div className="font-bold font-mono text-2xl text-rose-700">
                {totalBreakdown.toFixed(1)} h
              </div>
              <div className="text-[10px] text-gray-500">{monthLogs.length} Tickets Logged</div>
            </div>
          </div>
        </div>

        {/* Section 1: Top 5 Bottlenecks & Critical Maintenance Issues */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-rose-700" />
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
              1. Priority Bottlenecks &amp; High-Impact Breakdown Machines
            </h2>
          </div>
          <table className="w-full border border-gray-300 text-left text-xs">
            <thead className="border-b bg-gray-100 font-bold text-[10px] text-gray-700 uppercase">
              <tr>
                <th className="p-2">Machine</th>
                <th className="p-2">Type / Site</th>
                <th className="p-2 text-right">Worked SMR</th>
                <th className="p-2 text-right">Breakdown (h)</th>
                <th className="p-2 text-right">MTBF (h)</th>
                <th className="p-2 text-right">MTTR (h)</th>
                <th className="p-2 text-center">Health Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topBottlenecks.map((m) => (
                <tr key={`bn-${m.machineId}`}>
                  <td className="p-2 font-bold font-mono text-gray-900">{m.machineName}</td>
                  <td className="p-2 text-gray-600">
                    {m.machineType} · {m.siteName}
                  </td>
                  <td className="p-2 text-right font-mono">{m.totalSmrWorked.toFixed(1)}h</td>
                  <td className="p-2 text-right font-bold font-mono text-rose-700">
                    {m.totalBreakdownHours.toFixed(1)}h
                  </td>
                  <td className="p-2 text-right font-mono">{m.mtbfHours}h</td>
                  <td className="p-2 text-right font-mono">{m.mttrHours}h</td>
                  <td className="p-2 text-center">
                    <span
                      className={`rounded px-2 py-0.5 font-bold font-mono text-[10px] uppercase ${
                        m.healthRiskLevel === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : m.healthRiskLevel === 'elevated'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {m.healthRiskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 2: Proactive 250h / 500h Service Interlock Warnings */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600" />
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
              2. Proactive Maintenance &amp; Service Interval Forecast
            </h2>
          </div>
          {upcomingServices.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-600 text-xs">
              All machines are currently operating outside the immediate 25h preventive service
              window.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {upcomingServices.map((s) => (
                <div
                  key={`srv-${s.machineId}`}
                  className="rounded-lg border border-amber-300 bg-amber-50/50 p-2.5 text-xs"
                >
                  <div className="font-bold text-gray-900">{s.machineName}</div>
                  <div className="text-[11px] text-gray-600">{s.siteName}</div>
                  <div className="mt-1 font-mono text-[11px]">
                    {s.serviceIntervalProximity.isApproaching250Service && (
                      <span className="font-bold text-amber-800">
                        Approaching 250h Service ({s.serviceIntervalProximity.hoursToNext250Service}
                        h remaining)
                      </span>
                    )}
                    {s.serviceIntervalProximity.isApproaching500Service && (
                      <span className="font-bold text-rose-800">
                        Approaching 500h Major Service (
                        {s.serviceIntervalProximity.hoursToNext500Service}h remaining)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Executive Sign-off Block */}
        <div className="mt-8 border-gray-300 border-t pt-4">
          <div className="grid grid-cols-3 gap-6 text-gray-600 text-xs">
            <div>
              <div className="font-semibold text-gray-800">Prepared By:</div>
              <div className="mt-4 border-gray-400 border-b pb-1 font-mono">
                Control Room Superintendent
              </div>
              <div className="text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800">Engineering Review:</div>
              <div className="mt-4 border-gray-400 border-b pb-1 font-mono">
                Chief Mechanical Engineer
              </div>
              <div className="text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800">Executive Approval:</div>
              <div className="mt-4 border-gray-400 border-b pb-1 font-mono">
                General Manager / CEO
              </div>
              <div className="text-[10px]">Date: ________________________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
