'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Printer,
  Shield,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AccessReportsData } from '../actions';

interface AccessReportsStudioProps {
  initialData: AccessReportsData;
}

export function AccessReportsStudio({ initialData }: AccessReportsStudioProps) {
  const [data] = useState<AccessReportsData>(initialData);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('7days');

  const handleExportCSV = () => {
    const headers = [
      'Audit ID',
      'Timestamp',
      'Gate Location',
      'Entity',
      'Type',
      'Action',
      'Status',
      'Reason',
    ];
    const rows = data.recentAudits.map((a) => [
      `"${a.id}"`,
      `"${a.timestamp}"`,
      `"${a.gate}"`,
      `"${a.entityName}"`,
      a.entityType,
      `"${a.action}"`,
      a.granted ? 'GRANTED' : 'DENIED',
      `"${a.reason || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `security_access_compliance_audit_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Compliance audit log exported successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <GlassCard variant="window" className="p-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-bold font-mono text-emerald-700 text-xs uppercase tracking-wider">
                  REGULATORY COMPLIANCE SUITE
                </span>
                <span className="font-mono text-[var(--text-muted)] text-xs">
                  MHSA / DMRE Section 21 & 22 Audit
                </span>
              </div>
              <h2 className="mt-1 font-black text-2xl text-[var(--text-heading)] tracking-tight">
                Security Access & Gate Telemetry Reports
              </h2>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Official access clearance logs, contractor hours reconciliation, and safety
                induction exception tracking
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2.5 lg:w-auto">
            {/* Date filter pills */}
            <div className="flex items-center rounded-lg bg-black/[0.04] p-1 font-medium text-xs">
              <button
                type="button"
                onClick={() => setDateRange('today')}
                className={`rounded-md px-3 py-1 transition-all ${
                  dateRange === 'today'
                    ? 'bg-white font-bold text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRange('7days')}
                className={`rounded-md px-3 py-1 transition-all ${
                  dateRange === '7days'
                    ? 'bg-white font-bold text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRange('30days')}
                className={`rounded-md px-3 py-1 transition-all ${
                  dateRange === '30days'
                    ? 'bg-white font-bold text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 font-bold text-white text-xs shadow-xs transition-all hover:bg-[var(--accent-blue)]/90 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Audit CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-3 py-2 font-bold text-[var(--text-heading)] text-xs transition-all hover:bg-black/[0.08] active:scale-95"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Pack</span>
            </button>
          </div>
        </div>

        {/* High-Density Compliance KPI Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-black/[0.06] border-t pt-5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase">
              Total Access Events
            </span>
            <div className="mt-1 font-black font-mono text-[var(--text-heading)] text-xl">
              {data.summary.totalEvents.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Gate & turnstile scans</span>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-emerald-700 uppercase">
              Granted Clearances
            </span>
            <div className="mt-1 font-black font-mono text-emerald-600 text-xl">
              {data.summary.grantedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-700/80">Authorized entries</span>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-amber-700 uppercase">
              Security Interlocks
            </span>
            <div className="mt-1 font-black font-mono text-amber-600 text-xl">
              {data.summary.deniedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-700/80">Blocked attempts</span>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-blue-700 uppercase">
              Compliance Rate
            </span>
            <div className="mt-1 font-black font-mono text-[var(--accent-blue)] text-xl">
              {data.summary.complianceRate}%
            </div>
            <span className="text-[10px] text-blue-700/80">Audit benchmark: 95%+</span>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-purple-700 uppercase">
              Active Credentials
            </span>
            <div className="mt-1 font-black font-mono text-purple-600 text-xl">
              {data.summary.activeCredentials}
            </div>
            <span className="text-[10px] text-purple-700/80">Valid RFID & QR cards</span>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
            <span className="font-mono font-semibold text-[10px] text-teal-700 uppercase">
              Contractor Hours
            </span>
            <div className="mt-1 font-black font-mono text-teal-600 text-xl">
              {data.summary.contractorHoursLogged}h
            </div>
            <span className="text-[10px] text-teal-700/80">On-site billing verification</span>
          </div>
        </div>
      </GlassCard>

      {/* Middle Row: Denial Reason Taxonomy & Gate Traffic */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Denial Reason Taxonomy */}
        <GlassCard variant="window" className="p-5">
          <div className="mb-4 flex items-center justify-between border-black/[0.06] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-sm">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <span>Security Interlock & Denial Reason Taxonomy</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Breakdown of access rejections by safety regulation type
              </p>
            </div>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-bold font-mono text-amber-700 text-xs">
              {data.summary.deniedCount} Events
            </span>
          </div>

          <div className="space-y-3">
            {data.denialTaxonomy.map((d) => (
              <div key={d.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-heading)]">{d.reason}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-[var(--text-heading)]">{d.count}</span>
                    <span className="text-[var(--text-muted)]">({d.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Gate Traffic Throughput */}
        <GlassCard variant="window" className="p-5">
          <div className="mb-4 flex items-center justify-between border-black/[0.06] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-sm">
                <Sliders className="h-4 w-4 text-[var(--accent-blue)]" />
                <span>Perimeter Barrier Traffic & Peak Load</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Inbound vs. Outbound distribution and peak congestion windows
              </p>
            </div>
            <span className="rounded bg-blue-500/10 px-2 py-0.5 font-bold font-mono text-[var(--accent-blue)] text-xs">
              5 Physical Barriers
            </span>
          </div>

          <div className="space-y-3">
            {data.gateTraffic.map((g) => (
              <div
                key={g.gateName}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white/60 p-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-[var(--text-heading)]">{g.gateName}</h4>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    Peak: {g.peakHour}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <ArrowDownRight className="h-3 w-3" />
                    IN: {g.inbound}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                    <ArrowUpRight className="h-3 w-3" />
                    OUT: {g.outbound}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Recent Security Audits Table */}
      <GlassCard variant="window" className="p-5">
        <div className="mb-4 flex items-center justify-between border-black/[0.06] border-b pb-3">
          <div>
            <h3 className="font-bold text-[var(--text-heading)] text-sm">
              Audit Event Trail & Security Exceptions
            </h3>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Immutable ledger timestamps and scan verification outcomes
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            Showing last {data.recentAudits.length} events
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-black/[0.08] border-b bg-black/[0.03] font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Audit ID</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Gate Location</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Audit Note / Denial Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] bg-white/50">
              {data.recentAudits.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                    {a.id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                    {a.timestamp}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-heading)]">{a.gate}</td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-[var(--text-heading)]">
                      {a.entityName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{a.entityType}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                    {a.action}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[10px] ${
                        a.granted
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-red-500/10 text-red-700'
                      }`}
                    >
                      {a.granted ? 'GRANTED' : 'DENIED'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--text-muted)]">
                    {a.reason || 'Standard Badge Verification'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
