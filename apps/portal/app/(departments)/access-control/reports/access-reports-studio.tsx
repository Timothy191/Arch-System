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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded">
                  REGULATORY COMPLIANCE SUITE
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  MHSA / DMRE Section 21 & 22 Audit
                </span>
              </div>
              <h2 className="text-2xl font-black text-[var(--text-heading)] mt-1 tracking-tight">
                Security Access & Gate Telemetry Reports
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Official access clearance logs, contractor hours reconciliation, and safety
                induction exception tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            {/* Date filter pills */}
            <div className="flex items-center bg-black/[0.04] p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setDateRange('today')}
                className={`px-3 py-1 rounded-md transition-all ${
                  dateRange === 'today'
                    ? 'bg-white text-[var(--text-heading)] font-bold shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRange('7days')}
                className={`px-3 py-1 rounded-md transition-all ${
                  dateRange === '7days'
                    ? 'bg-white text-[var(--text-heading)] font-bold shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRange('30days')}
                className={`px-3 py-1 rounded-md transition-all ${
                  dateRange === '30days'
                    ? 'bg-white text-[var(--text-heading)] font-bold shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-black/[0.04] hover:bg-black/[0.08] text-[var(--text-heading)] px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Pack</span>
            </button>
          </div>
        </div>

        {/* High-Density Compliance KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-black/[0.06]">
          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-[var(--text-muted)]">
              Total Access Events
            </span>
            <div className="text-xl font-black font-mono text-[var(--text-heading)] mt-1">
              {data.summary.totalEvents.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Gate & turnstile scans</span>
          </div>

          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-emerald-700">
              Granted Clearances
            </span>
            <div className="text-xl font-black font-mono text-emerald-600 mt-1">
              {data.summary.grantedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-700/80">Authorized entries</span>
          </div>

          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-amber-700">
              Security Interlocks
            </span>
            <div className="text-xl font-black font-mono text-amber-600 mt-1">
              {data.summary.deniedCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-700/80">Blocked attempts</span>
          </div>

          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-blue-700">
              Compliance Rate
            </span>
            <div className="text-xl font-black font-mono text-[var(--accent-blue)] mt-1">
              {data.summary.complianceRate}%
            </div>
            <span className="text-[10px] text-blue-700/80">Audit benchmark: 95%+</span>
          </div>

          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-purple-700">
              Active Credentials
            </span>
            <div className="text-xl font-black font-mono text-purple-600 mt-1">
              {data.summary.activeCredentials}
            </div>
            <span className="text-[10px] text-purple-700/80">Valid RFID & QR cards</span>
          </div>

          <div className="bg-white/60 p-3.5 rounded-xl border border-black/[0.06]">
            <span className="text-[10px] font-mono font-semibold uppercase text-teal-700">
              Contractor Hours
            </span>
            <div className="text-xl font-black font-mono text-teal-600 mt-1">
              {data.summary.contractorHoursLogged}h
            </div>
            <span className="text-[10px] text-teal-700/80">On-site billing verification</span>
          </div>
        </div>
      </GlassCard>

      {/* Middle Row: Denial Reason Taxonomy & Gate Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Denial Reason Taxonomy */}
        <GlassCard variant="window" className="p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-heading)] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Security Interlock & Denial Reason Taxonomy</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Breakdown of access rejections by safety regulation type
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded">
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
                <div className="w-full bg-black/[0.05] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Gate Traffic Throughput */}
        <GlassCard variant="window" className="p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-heading)] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--accent-blue)]" />
                <span>Perimeter Barrier Traffic & Peak Load</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Inbound vs. Outbound distribution and peak congestion windows
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-blue-500/10 text-[var(--accent-blue)] px-2 py-0.5 rounded">
              5 Physical Barriers
            </span>
          </div>

          <div className="space-y-3">
            {data.gateTraffic.map((g) => (
              <div
                key={g.gateName}
                className="bg-white/60 p-3 rounded-xl border border-black/[0.06] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-[var(--text-heading)]">{g.gateName}</h4>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    Peak: {g.peakHour}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                    <ArrowDownRight className="w-3 h-3" />
                    IN: {g.inbound}
                  </span>
                  <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                    <ArrowUpRight className="w-3 h-3" />
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
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-heading)]">
              Audit Event Trail & Security Exceptions
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Immutable ledger timestamps and scan verification outcomes
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Showing last {data.recentAudits.length} events
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-black/[0.03] border-b border-black/[0.08] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Gate Location</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit Note / Denial Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] bg-white/50">
              {data.recentAudits.map((a) => (
                <tr key={a.id} className="hover:bg-black/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)]">
                    {a.id.substring(0, 8)}...
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                    {a.timestamp}
                  </td>
                  <td className="py-3 px-4 font-medium text-[var(--text-heading)]">{a.gate}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-[var(--text-heading)] block">
                      {a.entityName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{a.entityType}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                    {a.action}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        a.granted
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-red-500/10 text-red-700'
                      }`}
                    >
                      {a.granted ? 'GRANTED' : 'DENIED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
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
