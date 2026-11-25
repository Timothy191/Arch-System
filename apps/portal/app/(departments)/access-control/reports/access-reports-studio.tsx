'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  MessageSquare,
  Printer,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AccessReportsData } from '../actions';
import {
  type AccessWhatsAppSections,
  buildAccessWhatsAppBrief,
  buildAccessWhatsAppUrl,
  DEFAULT_ACCESS_WHATSAPP_SECTIONS,
  formatAccessGateTimestamp,
} from './access-control-whatsapp';

export type AccessReportTab = 'dashboard' | 'pdf-report' | 'whatsapp-report';
export type AccessReportRange = 'today' | '7days' | '30days';
type ZoomLevel = 'fit' | '100' | '75';

export interface AccessReportsStudioProps {
  readonly initialData: AccessReportsData;
  readonly initialTab?: AccessReportTab;
  readonly initialRange?: AccessReportRange;
  readonly reportDate?: string;
}

interface ReportTabItem {
  readonly id: AccessReportTab;
  readonly label: string;
  readonly href: string;
}

interface RangeOption {
  readonly id: AccessReportRange;
  readonly label: string;
}

interface ZoomOption {
  readonly id: ZoomLevel;
  readonly label: string;
}

interface WhatsappToggleOption {
  readonly key: keyof AccessWhatsAppSections;
  readonly label: string;
  readonly description: string;
}

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;
const OBJECT_URL_REVOKE_DELAY_MS = 5_000;
const COPIED_RESET_DELAY_MS = 2_000;
const MAX_BAR_PCT = 100;

const REPORT_TABS: readonly ReportTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/access-control/reports' },
  { id: 'pdf-report', label: 'PDF Report', href: '/access-control/reports?tab=pdf-report' },
  {
    id: 'whatsapp-report',
    label: 'WhatsApp Report',
    href: '/access-control/reports?tab=whatsapp-report',
  },
];

const RANGE_OPTIONS: readonly RangeOption[] = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
];

const RANGE_LABELS: Record<AccessReportRange, string> = {
  today: 'Today',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
};

const ZOOM_OPTIONS: readonly ZoomOption[] = [
  { id: 'fit', label: 'Fit' },
  { id: '100', label: '100%' },
  { id: '75', label: '75%' },
];

const ZOOM_STYLES: Record<ZoomLevel, CSSProperties> = {
  fit: { width: '210mm', maxWidth: '100%' },
  '100': { width: '210mm', transform: 'scale(1)', transformOrigin: 'top center' },
  '75': { width: '210mm', transform: 'scale(0.75)', transformOrigin: 'top center' },
};

const WHATSAPP_TOGGLES: readonly WhatsappToggleOption[] = [
  {
    key: 'includeKpiSummary',
    label: 'Include KPI Summary',
    description: 'Total scans, granted clearances, interlocks, compliance rate & hours',
  },
  {
    key: 'includeDenialReasons',
    label: 'Include Denial Reasons',
    description: 'Security interlock breakdown and percentage distribution',
  },
  {
    key: 'includeGateTraffic',
    label: 'Include Gate Traffic',
    description: 'Inbound and outbound counts across perimeter barriers',
  },
  {
    key: 'includeAuditHighlights',
    label: 'Include Audit Highlights',
    description: 'Latest security scan outcomes and exception notes',
  },
];

const SEGMENT_GROUP_CLASS =
  'inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1';
const SEGMENT_BASE_CLASS = 'rounded-md px-3 py-1.5 font-medium text-xs transition-all';
const SEGMENT_ACTIVE_CLASS =
  'bg-[var(--bg-primary)] font-bold text-[var(--text-heading)] shadow-2xs';
const SEGMENT_INACTIVE_CLASS = 'text-[var(--text-muted)] hover:text-[var(--text-heading)]';
const KPI_CARD_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5';
const BTN_PRIMARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 font-bold text-white text-xs shadow-xs transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60';
const BTN_SECONDARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-bold text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]';
const BTN_WHATSAPP_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-green)] px-3.5 py-2 font-bold text-white text-xs shadow-xs transition-opacity hover:opacity-90';
const PAPER_CLASS =
  'mx-auto flex min-h-[297mm] flex-col gap-6 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-[12mm] text-[var(--text-heading)] shadow-md print:rounded-none print:border-0 print:shadow-none';
const PAPER_SECTION_TITLE_CLASS =
  'mb-2 border-[var(--border-default)] border-b pb-1 font-bold text-[11px] text-[var(--text-heading)] uppercase tracking-wide';
const PAPER_TH_CLASS =
  'border-[var(--border-default)] border-b bg-[var(--bg-secondary)] px-2 py-1.5 text-left font-semibold text-[10px] text-[var(--text-secondary)] uppercase';
const PAPER_TD_CLASS = 'border-[var(--border-subtle)] border-b px-2 py-1.5 align-top text-[11px]';
const TABLE_TH_CLASS = 'px-4 py-3';
const TABLE_TD_CLASS = 'px-4 py-3';

/**
 * Neutralizes CSV/formula injection and quotes a single cell per RFC-4180.
 */
export function escapeAccessReportCsvCell(rawCell: string): string {
  const neutralized = CSV_FORMULA_PREFIX.test(rawCell) ? `'${rawCell}` : rawCell;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/**
 * Builds the sanitized CSV payload for the access-control audit trail.
 */
export function buildAccessAuditCsv(reportData: AccessReportsData): string {
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
  const rows = reportData.recentAudits.map((auditEntry) => [
    escapeAccessReportCsvCell(auditEntry.id),
    escapeAccessReportCsvCell(auditEntry.timestamp),
    escapeAccessReportCsvCell(auditEntry.gate),
    escapeAccessReportCsvCell(auditEntry.entityName),
    escapeAccessReportCsvCell(auditEntry.entityType),
    escapeAccessReportCsvCell(auditEntry.action),
    escapeAccessReportCsvCell(auditEntry.granted ? 'GRANTED' : 'DENIED'),
    escapeAccessReportCsvCell(auditEntry.reason || ''),
  ]);
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function triggerFileDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('href', objectUrl);
  anchor.setAttribute('download', fileName);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

function KpiTile(props: {
  readonly label: string;
  readonly metric: string;
  readonly hint: string;
  readonly toneClass?: string;
}) {
  return (
    <div className={KPI_CARD_CLASS}>
      <span className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase">
        {props.label}
      </span>
      <div
        className={`mt-1 font-black font-mono text-xl ${props.toneClass ?? 'text-[var(--text-heading)]'}`}
      >
        {props.metric}
      </div>
      <span className="text-[10px] text-[var(--text-muted)]">{props.hint}</span>
    </div>
  );
}

function KpiMetricGrid({ reportData }: { readonly reportData: AccessReportsData }) {
  const { summary } = reportData;
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 border-[var(--border-subtle)] border-t pt-5 sm:grid-cols-3 lg:grid-cols-6">
      <KpiTile
        label="Total Access Events"
        metric={summary.totalEvents.toLocaleString('en-US')}
        hint="Gate & turnstile scans"
      />
      <KpiTile
        label="Granted Clearances"
        metric={summary.grantedCount.toLocaleString('en-US')}
        hint="Authorized entries"
        toneClass="text-[var(--accent-green)]"
      />
      <KpiTile
        label="Security Interlocks"
        metric={summary.deniedCount.toLocaleString('en-US')}
        hint="Blocked attempts"
        toneClass="text-[var(--accent-amber)]"
      />
      <KpiTile
        label="Compliance Rate"
        metric={`${summary.complianceRate}%`}
        hint="Audit benchmark: 95%+"
        toneClass="text-[var(--accent-blue)]"
      />
      <KpiTile
        label="Active Credentials"
        metric={summary.activeCredentials.toLocaleString('en-US')}
        hint="Valid RFID & QR cards"
      />
      <KpiTile
        label="Contractor Hours"
        metric={`${summary.contractorHoursLogged.toLocaleString('en-US')}h`}
        hint="On-site billing verification"
      />
    </div>
  );
}

function StudioHeader(props: {
  readonly activeTab: AccessReportTab;
  readonly onSelectTab: (nextTab: AccessReportTab) => void;
  readonly dateRange: AccessReportRange;
  readonly onSelectRange: (nextRange: AccessReportRange) => void;
  readonly reportDate: string;
  readonly reportData: AccessReportsData;
  readonly isGeneratingPdf: boolean;
  readonly onExportCsv: () => void;
  readonly onDownloadPdf: () => void;
}) {
  return (
    <GlassCard className="gold-steel-border gold-steel-border-slim !bg-none !bg-white border border-accent-gold/70 p-6 shadow-sm print:hidden">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--accent-green)]">
            <FileCheck2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[var(--bg-secondary)] px-2 py-0.5 font-bold font-mono text-[var(--accent-green)] text-xs uppercase tracking-wider">
                REGULATORY COMPLIANCE SUITE
              </span>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                MHSA / DMRE Section 21 &amp; 22 Audit · {props.reportDate}
              </span>
            </div>
            <h2 className="mt-1 font-black text-2xl text-[var(--text-heading)] tracking-tight">
              Security Access &amp; Gate Telemetry Reports
            </h2>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Official access clearance logs, contractor hours reconciliation, and safety induction
              exception tracking
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-2.5 lg:w-auto lg:items-end">
          <nav aria-label="Access control report views" className={SEGMENT_GROUP_CLASS}>
            {REPORT_TABS.map((tab) => {
              const isCurrent = tab.id === props.activeTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => props.onSelectTab(tab.id)}
                  className={`${SEGMENT_BASE_CLASS} ${isCurrent ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Reporting window" className={SEGMENT_GROUP_CLASS}>
              {RANGE_OPTIONS.map((option) => {
                const isSelected = option.id === props.dateRange;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => props.onSelectRange(option.id)}
                    className={`${SEGMENT_BASE_CLASS} ${isSelected ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {props.activeTab === 'dashboard' && (
              <>
                <button type="button" onClick={props.onExportCsv} className={BTN_PRIMARY_CLASS}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export Audit CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={BTN_SECONDARY_CLASS}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print Pack</span>
                </button>
              </>
            )}

            {props.activeTab === 'pdf-report' && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={BTN_SECONDARY_CLASS}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print Pack</span>
                </button>
                <button
                  type="button"
                  disabled={props.isGeneratingPdf}
                  onClick={props.onDownloadPdf}
                  className={BTN_PRIMARY_CLASS}
                >
                  {props.isGeneratingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{props.isGeneratingPdf ? 'Preparing PDF…' : 'Download Security PDF'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {props.activeTab === 'dashboard' && <KpiMetricGrid reportData={props.reportData} />}
    </GlassCard>
  );
}

function DashboardView({ reportData }: { readonly reportData: AccessReportsData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GlassCard variant="window" className="p-5">
          <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-sm">
                <ShieldAlert className="h-4 w-4 text-[var(--accent-amber)]" aria-hidden="true" />
                <span>Security Interlock &amp; Denial Reason Taxonomy</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Breakdown of access rejections by safety regulation type
              </p>
            </div>
            <span className="rounded bg-[var(--bg-secondary)] px-2 py-0.5 font-bold font-mono text-[var(--accent-amber)] text-xs">
              {reportData.summary.deniedCount.toLocaleString('en-US')} Events
            </span>
          </div>

          <div className="space-y-3">
            {reportData.denialTaxonomy.map((denial) => {
              const widthPct = Math.max(0, Math.min(MAX_BAR_PCT, denial.percentage));
              return (
                <div key={denial.reason} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-heading)]">{denial.reason}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-[var(--text-heading)]">
                        {denial.count.toLocaleString('en-US')}
                      </span>
                      <span className="text-[var(--text-muted)]">({denial.percentage}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-amber)] transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard variant="window" className="p-5">
          <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-sm">
                <Sliders className="h-4 w-4 text-[var(--accent-blue)]" aria-hidden="true" />
                <span>Perimeter Barrier Traffic &amp; Peak Load</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Inbound vs. Outbound distribution and peak congestion windows
              </p>
            </div>
            <span className="rounded bg-[var(--bg-secondary)] px-2 py-0.5 font-bold font-mono text-[var(--accent-blue)] text-xs">
              {reportData.gateTraffic.length.toLocaleString('en-US')} Physical Barriers
            </span>
          </div>

          <div className="space-y-3">
            {reportData.gateTraffic.map((gate) => (
              <div
                key={gate.gateName}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-[var(--text-heading)]">{gate.gateName}</h4>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    Peak: {formatAccessGateTimestamp(gate.peakHour)}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="flex items-center gap-1 rounded bg-[var(--bg-primary)] px-2 py-0.5 font-semibold text-[var(--accent-green)]">
                    <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                    IN: {gate.inbound.toLocaleString('en-US')}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-[var(--bg-primary)] px-2 py-0.5 font-semibold text-[var(--accent-blue)]">
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    OUT: {gate.outbound.toLocaleString('en-US')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard variant="window" className="p-5">
        <div className="mb-4 flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
          <div>
            <h3 className="font-bold text-[var(--text-heading)] text-sm">
              Audit Event Trail &amp; Security Exceptions
            </h3>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Immutable ledger timestamps and scan verification outcomes
            </p>
          </div>
          <span className="font-mono text-[var(--text-muted)] text-xs">
            Showing last {reportData.recentAudits.length} events
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)] font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              <tr>
                <th className={TABLE_TH_CLASS}>Audit ID</th>
                <th className={TABLE_TH_CLASS}>Timestamp</th>
                <th className={TABLE_TH_CLASS}>Gate Location</th>
                <th className={TABLE_TH_CLASS}>Entity</th>
                <th className={TABLE_TH_CLASS}>Action</th>
                <th className={TABLE_TH_CLASS}>Status</th>
                <th className={TABLE_TH_CLASS}>Audit Note / Denial Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-primary)]">
              {reportData.recentAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No security audit events recorded in this reporting window.
                  </td>
                </tr>
              ) : (
                reportData.recentAudits.map((auditEntry) => (
                  <tr
                    key={auditEntry.id}
                    className="transition-colors hover:bg-[var(--bg-secondary)]"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {auditEntry.id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                      {auditEntry.timestamp}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-heading)]">
                      {auditEntry.gate}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <span className="block font-semibold text-[var(--text-heading)]">
                        {auditEntry.entityName}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {auditEntry.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                      {auditEntry.action}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <span
                        className={`inline-flex items-center rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 font-bold text-[10px] ${
                          auditEntry.granted
                            ? 'text-[var(--accent-green)]'
                            : 'text-[var(--accent-red)]'
                        }`}
                      >
                        {auditEntry.granted ? 'GRANTED' : 'DENIED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-muted)]">
                      {auditEntry.reason || 'Standard Badge Verification'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function PdfReportPreview(props: {
  readonly reportData: AccessReportsData;
  readonly reportDate: string;
  readonly rangeLabel: string;
  readonly zoom: ZoomLevel;
  readonly onSelectZoom: (nextZoom: ZoomLevel) => void;
}) {
  const { reportData, reportDate, rangeLabel, zoom, onSelectZoom } = props;
  const { summary } = reportData;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Live A4 Security Compliance Preview — mirrors the downloadable vector PDF.
        </p>
        <div role="group" aria-label="Preview zoom" className={SEGMENT_GROUP_CLASS}>
          {ZOOM_OPTIONS.map((option) => {
            const isSelected = option.id === zoom;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectZoom(option.id)}
                className={`${SEGMENT_BASE_CLASS} ${isSelected ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto pb-6">
        <article
          aria-label="Access Control PDF Report Preview"
          className={PAPER_CLASS}
          style={ZOOM_STYLES[zoom]}
        >
          <header className="flex items-end justify-between gap-6 border-[var(--text-heading)] border-b-2 pb-3">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10" />
              <div className="flex flex-col">
                <span className="font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-[0.18em]">
                  ARCH OS · ACCESS CONTROL &amp; SITE SECURITY
                </span>
                <h3 className="font-bold text-2xl text-[var(--text-heading)]">
                  Security Access &amp; Gate Telemetry Report
                </h3>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 text-right text-[10px]">
              <dt className="text-[var(--text-muted)]">Operational Date</dt>
              <dd className="font-semibold">{reportDate}</dd>
              <dt className="text-[var(--text-muted)]">Document ID</dt>
              <dd className="font-semibold">AC-RPT-{reportDate}</dd>
              <dt className="text-[var(--text-muted)]">Reporting Window</dt>
              <dd className="font-semibold">{rangeLabel}</dd>
              <dt className="text-[var(--text-muted)]">Standard</dt>
              <dd className="font-semibold">MHSA / DMRE Sec. 21 &amp; 22</dd>
            </dl>
          </header>

          <section aria-label="Compliance KPIs" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <KpiTile
              label="Total Events"
              metric={summary.totalEvents.toLocaleString('en-US')}
              hint="Gate scans"
            />
            <KpiTile
              label="Granted"
              metric={summary.grantedCount.toLocaleString('en-US')}
              hint="Cleared"
              toneClass="text-[var(--accent-green)]"
            />
            <KpiTile
              label="Interlocks"
              metric={summary.deniedCount.toLocaleString('en-US')}
              hint="Blocked"
              toneClass="text-[var(--accent-amber)]"
            />
            <KpiTile
              label="Compliance"
              metric={`${summary.complianceRate}%`}
              hint="Target 95%+"
              toneClass="text-[var(--accent-blue)]"
            />
            <KpiTile
              label="Credentials"
              metric={summary.activeCredentials.toLocaleString('en-US')}
              hint="Active cards"
            />
            <KpiTile
              label="Contractor Hrs"
              metric={`${summary.contractorHoursLogged.toLocaleString('en-US')}h`}
              hint="Logged hours"
            />
          </section>

          <section>
            <h4 className={PAPER_SECTION_TITLE_CLASS}>Denial Reason Taxonomy</h4>
            <ul className="space-y-2">
              {reportData.denialTaxonomy.map((denial) => {
                const widthPct = Math.max(0, Math.min(MAX_BAR_PCT, denial.percentage));
                return (
                  <li key={denial.reason} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold">{denial.reason}</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {denial.count.toLocaleString('en-US')} ({denial.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent-amber)]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h4 className={PAPER_SECTION_TITLE_CLASS}>Perimeter Gate Throughput</h4>
            <table aria-label="Perimeter Gate Throughput" className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Gate Location
                  </th>
                  <th scope="col" className={`${PAPER_TH_CLASS} text-right`}>
                    Inbound
                  </th>
                  <th scope="col" className={`${PAPER_TH_CLASS} text-right`}>
                    Outbound
                  </th>
                  <th scope="col" className={`${PAPER_TH_CLASS} text-right`}>
                    Total Scans
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Last Peak Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.gateTraffic.map((gate) => (
                  <tr key={gate.gateName}>
                    <td className={`${PAPER_TD_CLASS} font-semibold`}>{gate.gateName}</td>
                    <td className={`${PAPER_TD_CLASS} text-right tabular-nums`}>
                      {gate.inbound.toLocaleString('en-US')}
                    </td>
                    <td className={`${PAPER_TD_CLASS} text-right tabular-nums`}>
                      {gate.outbound.toLocaleString('en-US')}
                    </td>
                    <td className={`${PAPER_TD_CLASS} text-right font-semibold tabular-nums`}>
                      {(gate.inbound + gate.outbound).toLocaleString('en-US')}
                    </td>
                    <td className={PAPER_TD_CLASS}>{formatAccessGateTimestamp(gate.peakHour)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h4 className={PAPER_SECTION_TITLE_CLASS}>Audit Event Trail &amp; Exceptions</h4>
            <table aria-label="PDF Audit Event Trail" className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Timestamp
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Gate
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Entity
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Action
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Status
                  </th>
                  <th scope="col" className={PAPER_TH_CLASS}>
                    Note / Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.recentAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-[11px] text-[var(--text-muted)]">
                      No security audit events recorded in this reporting window.
                    </td>
                  </tr>
                ) : (
                  reportData.recentAudits.map((auditEntry) => (
                    <tr key={auditEntry.id}>
                      <td className={PAPER_TD_CLASS}>{auditEntry.timestamp}</td>
                      <td className={`${PAPER_TD_CLASS} font-semibold`}>{auditEntry.gate}</td>
                      <td className={PAPER_TD_CLASS}>{auditEntry.entityName}</td>
                      <td className={PAPER_TD_CLASS}>{auditEntry.action}</td>
                      <td
                        className={`${PAPER_TD_CLASS} font-bold ${
                          auditEntry.granted
                            ? 'text-[var(--accent-green)]'
                            : 'text-[var(--accent-red)]'
                        }`}
                      >
                        {auditEntry.granted ? 'GRANTED' : 'DENIED'}
                      </td>
                      <td className={PAPER_TD_CLASS}>
                        {auditEntry.reason || 'Standard Badge Verification'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section aria-label="Executive Sign-off" className="mt-auto grid grid-cols-3 gap-8 pt-8">
            {['Security Officer', 'Site Safety Manager', 'Approval Date'].map((roleTitle) => (
              <div key={roleTitle} className="border-[var(--text-heading)] border-t pt-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase">{roleTitle}</span>
              </div>
            ))}
          </section>

          <footer className="flex justify-between border-[var(--border-default)] border-t pt-2 text-[10px] text-[var(--text-muted)]">
            <span>Plantcor / Arch OS · Confidential Security Compliance Report</span>
            <span>Page 1 of 1</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function WhatsappToggleSwitch(props: {
  readonly option: WhatsappToggleOption;
  readonly isEnabled: boolean;
  readonly onToggle: (key: keyof AccessWhatsAppSections) => void;
}) {
  const { option, isEnabled, onToggle } = props;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
      <div>
        <span className="block font-semibold text-[var(--text-heading)] text-xs">
          {option.label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">{option.description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={option.label}
        onClick={() => onToggle(option.key)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border-default)] transition-colors ${
          isEnabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-tertiary)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-[var(--bg-primary)] shadow-2xs transition-transform ${
            isEnabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function WhatsappComposerView(props: {
  readonly reportData: AccessReportsData;
  readonly reportDate: string;
  readonly rangeLabel: string;
}) {
  const [sections, setSections] = useState<AccessWhatsAppSections>(
    DEFAULT_ACCESS_WHATSAPP_SECTIONS
  );
  const [isCopied, setIsCopied] = useState(false);

  const briefText = useMemo(
    () =>
      buildAccessWhatsAppBrief({
        reportData: props.reportData,
        reportDate: props.reportDate,
        rangeLabel: props.rangeLabel,
        sections,
      }),
    [props.reportData, props.reportDate, props.rangeLabel, sections]
  );

  const whatsappUrl = useMemo(() => buildAccessWhatsAppUrl(briefText), [briefText]);

  const handleToggleSection = (key: keyof AccessWhatsAppSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(briefText);
      setIsCopied(true);
      toast.success('WhatsApp security brief copied to clipboard.');
      setTimeout(() => setIsCopied(false), COPIED_RESET_DELAY_MS);
    } catch (_err: unknown) {
      toast.error('Unable to copy to clipboard. Please copy the preview text manually.');
    }
  };

  return (
    <GlassCard variant="window" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-[var(--border-subtle)] border-b pb-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
            <MessageSquare className="h-5 w-5 text-[var(--accent-green)]" aria-hidden="true" />
            <span>WhatsApp Security Dispatch Brief</span>
          </h3>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Configure summary sections and dispatch directly to site security WhatsApp groups
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyBrief()}
            className={BTN_SECONDARY_CLASS}
          >
            {isCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[var(--accent-green)]" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy WhatsApp Report</span>
              </>
            )}
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN_WHATSAPP_CLASS}
          >
            <span>Send via WhatsApp</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
              Message Sections
            </h4>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              {briefText.length.toLocaleString('en-US')} chars
            </span>
          </div>
          {WHATSAPP_TOGGLES.map((option) => (
            <WhatsappToggleSwitch
              key={option.key}
              option={option}
              isEnabled={sections[option.key]}
              onToggle={handleToggleSection}
            />
          ))}
        </div>

        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
              Live Formatted Preview
            </h4>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              {props.rangeLabel}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <pre
              aria-label="WhatsApp Security Brief Preview"
              className="whitespace-pre-wrap font-mono text-[var(--text-heading)] text-xs leading-relaxed"
            >
              {briefText}
            </pre>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * Multi-view Access Control reporting studio supporting Dashboard, A4 PDF Studio,
 * and WhatsApp Security Brief composition.
 */
export function AccessReportsStudio(props: AccessReportsStudioProps) {
  const {
    initialData,
    initialTab = 'dashboard',
    initialRange = '7days',
    reportDate = new Date().toISOString().slice(0, 10),
  } = props;

  const reportData = initialData;
  const [activeTab, setActiveTab] = useState<AccessReportTab>(initialTab);
  const [dateRange, setDateRange] = useState<AccessReportRange>(initialRange);
  const [zoom, setZoom] = useState<ZoomLevel>('fit');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setDateRange(initialRange);
  }, [initialRange]);

  const rangeLabel = RANGE_LABELS[dateRange];

  const handleExportCsv = () => {
    const csvPayload = buildAccessAuditCsv(reportData);
    const blob = new Blob([csvPayload], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload(blob, `security_access_compliance_audit_${reportDate}.csv`);
    toast.success('Compliance audit log exported successfully.');
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const [{ pdf }, { AccessControlPdfDocument }, React] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./AccessControlPdfDocument'),
        import('react'),
      ]);
      const docElement = React.createElement(AccessControlPdfDocument, {
        reportData,
        reportDate,
        rangeLabel,
      });
      const blob = await pdf(docElement as unknown as Parameters<typeof pdf>[0]).toBlob();
      triggerFileDownload(blob, `Access-Control-Security-Report-${reportDate}.pdf`);
      toast.success('Security compliance PDF report downloaded.');
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      toast.error(`Direct PDF generation failed (${reason}); opening print preview instead.`);
      if (typeof window !== 'undefined') {
        window.print();
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        dateRange={dateRange}
        onSelectRange={setDateRange}
        reportDate={reportDate}
        reportData={reportData}
        isGeneratingPdf={isGeneratingPdf}
        onExportCsv={handleExportCsv}
        onDownloadPdf={() => void handleDownloadPdf()}
      />

      {activeTab === 'dashboard' && <DashboardView reportData={reportData} />}

      {activeTab === 'pdf-report' && (
        <PdfReportPreview
          reportData={reportData}
          reportDate={reportDate}
          rangeLabel={rangeLabel}
          zoom={zoom}
          onSelectZoom={setZoom}
        />
      )}

      {activeTab === 'whatsapp-report' && (
        <WhatsappComposerView
          reportData={reportData}
          reportDate={reportDate}
          rangeLabel={rangeLabel}
        />
      )}
    </div>
  );
}
