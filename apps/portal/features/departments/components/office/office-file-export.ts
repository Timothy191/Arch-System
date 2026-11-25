import { toast } from 'sonner';
import type { OfficeDocumentRecord, OfficeSopLiveReportData } from './actions';
import { downloadOfficeSopPdf } from './office-pdf-export';

export type OfficeExportFormat = 'pdf' | 'csv' | 'md' | 'json';

export interface DownloadOfficeArtifactOptions {
  readonly document: OfficeDocumentRecord;
  readonly reportData: OfficeSopLiveReportData;
  readonly format: OfficeExportFormat;
}

export interface DownloadOfficeArtifactResult {
  readonly didDownload: boolean;
  readonly fileName: string;
  readonly format: OfficeExportFormat;
}

const OBJECT_URL_REVOKE_DELAY_MS = 5_000;
const SOP_DOCUMENT_ID = 'office-doc-shift-handover-sop';

/** Build a deterministic, sanitized filename for downloading an Office artifact to device storage. */
export function buildOfficeArtifactFileName(
  title: string,
  operationalDate: string,
  extension: string,
  documentId?: string
): string {
  if (extension === 'pdf' && documentId === SOP_DOCUMENT_ID) {
    return `Executive-Shift-Handover-Safety-SOP-${operationalDate}.pdf`;
  }
  const cleanSlug = title
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseName = cleanSlug.length > 0 ? cleanSlug : 'Office-Executive-Artifact';
  return `${baseName}-${operationalDate}.${extension}`;
}

function escapeCsvCell(rawValue: string | number): string {
  const stringValue = String(rawValue);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsvPayload(
  docEntry: OfficeDocumentRecord,
  reportData: OfficeSopLiveReportData
): string {
  const rows: (readonly (string | number)[])[] = [
    ['Section', 'Key / Entity', 'Metric / Requirement', 'Owner / Status', 'Date / Timestamp'],
    ['Metadata', 'Document ID', docEntry.id, docEntry.docType.toUpperCase(), docEntry.updatedAt],
    ['Metadata', 'Title', docEntry.title, docEntry.authorRole, reportData.operationalDate],
    [
      'Metadata',
      'Summary',
      docEntry.summary,
      reportData.dataSourceStatus,
      reportData.generatedAtIso,
    ],
    [
      'Live KPI',
      'Active Breakdowns',
      reportData.activeBreakdownsCount,
      `${reportData.recent24hBreakdownsCount} in 24h`,
      reportData.operationalDate,
    ],
    [
      'Live KPI',
      'Installed Fleet Tires',
      reportData.installedTiresCount,
      `${reportData.criticalTiresCount} critical alerts`,
      reportData.operationalDate,
    ],
    [
      'Live KPI',
      'Site Visitors On-Site',
      reportData.checkedInVisitorsCount,
      `${reportData.recentAccessScansCount} gate scans`,
      reportData.operationalDate,
    ],
    [
      'Live KPI',
      'Shift Daily Logs',
      reportData.recentDailyLogsCount,
      reportData.latestShiftNote,
      reportData.operationalDate,
    ],
  ];

  for (const bd of reportData.recentBreakdowns) {
    rows.push([
      'Breakdown',
      bd.fleetLabel,
      bd.reason,
      bd.status.toUpperCase(),
      `${bd.delayHours}h · ${bd.dateIn}`,
    ]);
  }
  for (const step of reportData.protocolSteps) {
    rows.push([
      'SOP Protocol',
      `Step ${step.stepNumber} · ${step.stage}`,
      step.requirement,
      step.escalationOwner,
      reportData.operationalDate,
    ]);
  }

  return rows.map((cols) => cols.map(escapeCsvCell).join(',')).join('\r\n');
}

function buildMarkdownPayload(
  docEntry: OfficeDocumentRecord,
  reportData: OfficeSopLiveReportData
): string {
  const breakdownLines =
    reportData.recentBreakdowns.length === 0
      ? ['- No active breakdown incidents in current sync window.']
      : reportData.recentBreakdowns.map(
          (bd) =>
            `- **${bd.fleetLabel}** (${bd.status.toUpperCase()}, ${bd.delayHours}h delay): ${bd.reason} [${bd.dateIn}]`
        );

  const protocolLines = reportData.protocolSteps.map(
    (step) =>
      `${step.stepNumber}. **${step.stage}** — ${step.requirement} *(Owner: ${step.escalationOwner})*`
  );

  return [
    `# ${docEntry.title}`,
    '',
    `- **Document ID**: \`${docEntry.id}\``,
    `- **Modality**: ${docEntry.docType}`,
    `- **Author Role**: ${docEntry.authorRole}`,
    `- **Operational Date**: ${reportData.operationalDate}`,
    `- **Sync Source**: ${reportData.dataSourceStatus}`,
    '',
    '## Executive Summary',
    '',
    docEntry.summary,
    '',
    '## Live Operational Snapshot',
    '',
    `| Metric | Value | Detail |`,
    `| --- | ---: | --- |`,
    `| Active Breakdowns | ${reportData.activeBreakdownsCount} | ${reportData.recent24hBreakdownsCount} logged in 24h |`,
    `| Fleet Tires | ${reportData.installedTiresCount} | ${reportData.criticalTiresCount} critical |`,
    `| Checked-In Visitors | ${reportData.checkedInVisitorsCount} | ${reportData.recentAccessScansCount} gate scans |`,
    `| Shift Daily Logs | ${reportData.recentDailyLogsCount} | ${reportData.latestGateEvent} |`,
    '',
    `> **Latest Shift Note**: ${reportData.latestShiftNote}`,
    '',
    '## Live Breakdowns & Escalations',
    '',
    ...breakdownLines,
    '',
    '## Mandatory Shift Handover Protocol',
    '',
    ...protocolLines,
    '',
  ].join('\n');
}

/** Save a generated Blob directly to the operator's device via a temporary anchor click. */
export function downloadBlobToDevice(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
}

/** Generate and save an Office artifact to the user's device in PDF, CSV, Markdown, or JSON format. */
export async function downloadOfficeArtifactFile(
  options: DownloadOfficeArtifactOptions
): Promise<DownloadOfficeArtifactResult> {
  const { document: docEntry, reportData, format } = options;
  const fileName = buildOfficeArtifactFileName(
    docEntry.title,
    reportData.operationalDate,
    format,
    docEntry.id
  );

  if (format === 'pdf') {
    const didDownload = await downloadOfficeSopPdf({ reportData, fileName });
    return { didDownload, fileName, format };
  }

  try {
    let payloadText: string;
    let mimeType: string;
    if (format === 'csv') {
      payloadText = buildCsvPayload(docEntry, reportData);
      mimeType = 'text/csv;charset=utf-8';
    } else if (format === 'md') {
      payloadText = buildMarkdownPayload(docEntry, reportData);
      mimeType = 'text/markdown;charset=utf-8';
    } else {
      payloadText = JSON.stringify(
        { exportedAt: new Date().toISOString(), document: docEntry, reportData },
        null,
        2
      );
      mimeType = 'application/json;charset=utf-8';
    }

    const blob = new Blob([payloadText], { type: mimeType });
    downloadBlobToDevice(blob, fileName);
    toast.success(`Saved file to device: ${fileName}`);
    return { didDownload: true, fileName, format };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    toast.error(`Failed to save ${format.toUpperCase()} file (${reason}).`);
    return { didDownload: false, fileName, format };
  }
}
