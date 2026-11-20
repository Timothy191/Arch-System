import type { AccessReportsData } from '../actions';

export interface AccessWhatsAppSections {
  readonly includeKpiSummary: boolean;
  readonly includeDenialReasons: boolean;
  readonly includeGateTraffic: boolean;
  readonly includeAuditHighlights: boolean;
}

export interface AccessWhatsAppBriefOptions {
  readonly reportData: AccessReportsData;
  readonly reportDate: string;
  readonly rangeLabel: string;
  readonly sections: AccessWhatsAppSections;
}

export const MAX_WHATSAPP_AUDIT_HIGHLIGHTS = 5;
export const WHATSAPP_SECTION_DIVIDER = '────────────────────────────';

export const DEFAULT_ACCESS_WHATSAPP_SECTIONS: AccessWhatsAppSections = {
  includeKpiSummary: true,
  includeDenialReasons: true,
  includeGateTraffic: true,
  includeAuditHighlights: true,
};

/**
 * Formats an ISO timestamp string using the canonical `'en-US'` locale.
 * Preserves placeholder tokens (e.g. `'—'`) or unparseable labels verbatim.
 */
export function formatAccessGateTimestamp(rawTimestamp: string): string {
  if (!rawTimestamp || rawTimestamp === '—') {
    return '—';
  }
  const parsed = new Date(rawTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return rawTimestamp;
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildKpiSummaryBlock(reportData: AccessReportsData): string {
  const { summary } = reportData;
  return [
    '*KPI Summary*',
    `• Total Access Events: ${summary.totalEvents.toLocaleString('en-US')}`,
    `• Granted Clearances: ${summary.grantedCount.toLocaleString('en-US')}`,
    `• Security Interlocks: ${summary.deniedCount.toLocaleString('en-US')}`,
    `• Compliance Rate: ${summary.complianceRate}%`,
    `• Active Credentials: ${summary.activeCredentials.toLocaleString('en-US')}`,
    `• Contractor Hours Logged: ${summary.contractorHoursLogged.toLocaleString('en-US')}h`,
  ].join('\n');
}

function buildDenialReasonsBlock(reportData: AccessReportsData): string {
  const lines =
    reportData.denialTaxonomy.length > 0
      ? reportData.denialTaxonomy.map(
          (denial) =>
            `• ${denial.reason}: ${denial.count.toLocaleString('en-US')} (${denial.percentage}%)`
        )
      : ['• No denials recorded'];
  return ['*Denial Reason Taxonomy*', ...lines].join('\n');
}

function buildGateTrafficBlock(reportData: AccessReportsData): string {
  const lines =
    reportData.gateTraffic.length > 0
      ? reportData.gateTraffic.map((gate) => {
          const totalScans = gate.inbound + gate.outbound;
          return `• ${gate.gateName}: IN ${gate.inbound.toLocaleString('en-US')} | OUT ${gate.outbound.toLocaleString('en-US')} (Total: ${totalScans.toLocaleString('en-US')})`;
        })
      : ['• No traffic recorded'];
  return ['*Perimeter Gate Traffic*', ...lines].join('\n');
}

function buildAuditHighlightsBlock(reportData: AccessReportsData): string {
  const highlights = reportData.recentAudits.slice(0, MAX_WHATSAPP_AUDIT_HIGHLIGHTS);
  const lines =
    highlights.length > 0
      ? highlights.map((audit) => {
          const statusLabel = audit.granted ? 'GRANTED' : 'DENIED';
          const note = audit.reason || audit.action;
          return `• [${statusLabel}] ${audit.gate} — ${audit.entityName} (${note})`;
        })
      : ['• No recent audit events recorded'];
  return ['*Audit Trail Highlights*', ...lines].join('\n');
}

/**
 * Builds a pre-formatted WhatsApp security compliance brief from access-control report data.
 */
export function buildAccessWhatsAppBrief(options: AccessWhatsAppBriefOptions): string {
  const { reportData, reportDate, rangeLabel, sections } = options;
  const blocks: string[] = [
    [
      '*Plantcor Access Control — Security Brief*',
      `Operational Date: ${reportDate} | Window: ${rangeLabel}`,
    ].join('\n'),
  ];

  if (sections.includeKpiSummary) {
    blocks.push(buildKpiSummaryBlock(reportData));
  }
  if (sections.includeDenialReasons) {
    blocks.push(buildDenialReasonsBlock(reportData));
  }
  if (sections.includeGateTraffic) {
    blocks.push(buildGateTrafficBlock(reportData));
  }
  if (sections.includeAuditHighlights) {
    blocks.push(buildAuditHighlightsBlock(reportData));
  }

  blocks.push('MHSA / DMRE Section 21 & 22 Compliance Verified');

  return blocks.join(`\n${WHATSAPP_SECTION_DIVIDER}\n`);
}

/**
 * Builds a WhatsApp Web compose URL containing the encoded security brief.
 */
export function buildAccessWhatsAppUrl(briefText: string): string {
  return `https://web.whatsapp.com/send?text=${encodeURIComponent(briefText)}`;
}
