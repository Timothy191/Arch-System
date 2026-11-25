'use client';

import { Badge } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Eye,
  FileCode2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  Save,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  getOfficeSopLiveReportData,
  getOfficeWorkspaceSnapshot,
  type OfficeDocumentRecord,
  type OfficeDocumentType,
  type OfficeSopLiveReportData,
  saveOfficeDocumentAction,
} from './actions';
import { downloadOfficeArtifactFile, type OfficeExportFormat } from './office-file-export';

type OfficeWorkspaceMode = 'dashboard' | 'panels' | 'documents';

interface OfficeWorkspaceClientProps {
  readonly mode?: OfficeWorkspaceMode;
  readonly today: string;
  readonly initialDocuments?: readonly OfficeDocumentRecord[];
}

const OFFICE_DOCUMENTS_STORAGE_KEY = 'arch_office_documents_v1';
const SOP_DOCUMENT_ID = 'office-doc-shift-handover-sop';
const GENOFFICE_REPO_URL = 'https://github.com/genspark-ai/genoffice';

const GOLD_PILL_LINK_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-accent-gold/65 !bg-none !bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-colors hover:bg-[var(--bg-secondary)]';

const GOLD_STUDIO_HEADER_CLASS =
  'gold-steel-border gold-steel-border-slim flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-gold/70 !bg-none !bg-white px-5 py-3.5 shadow-sm';

const GOLD_PANEL_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-xl border border-accent-gold/65 !bg-none !bg-white p-4 shadow-2xs';

const GOLD_INPUT_CONTROL_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-lg border border-accent-gold/65 bg-white px-3 py-2 text-[var(--text-heading)] text-sm';

const GOLD_PRIMARY_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs transition-opacity hover:opacity-90 disabled:opacity-50';

const GOLD_EXPORT_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-accent-gold/65 !bg-none !bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-colors hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] disabled:cursor-wait disabled:opacity-60';

const ARTIFACT_CARD_DEFAULT_CLASS =
  'group flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-300/80 bg-[var(--bg-secondary)]/70 p-3 text-left text-xs transition-all hover:border-accent-gold hover:bg-white';

const ARTIFACT_CARD_ACTIVE_CLASS =
  'gold-steel-border gold-steel-border-slim group flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border border-accent-gold !bg-none !bg-white p-3 text-left text-xs shadow-sm';

interface QuickNavRoute {
  readonly href: string;
  readonly label: string;
}

const OFFICE_QUICK_LINKS: readonly QuickNavRoute[] = [
  { href: '/office', label: 'Office Suite Overview' },
  { href: '/office/panels', label: 'Artifact Studio' },
  { href: '/office/documents', label: 'Executive Documents' },
];

interface GenOfficeTabDescriptor {
  readonly id: OfficeDocumentType;
  readonly label: string;
  readonly templateTitle: string;
  readonly description: string;
  readonly metricsLine: string;
}

const GENOFFICE_TABS: readonly GenOfficeTabDescriptor[] = [
  {
    id: 'document',
    label: 'AI Document Writer',
    templateTitle: 'Executive Shift Handover & Statutory Safety Directive',
    description:
      'Draft structured mine manager directives, shift handover dossiers, and MHSA statutory compliance memos with live telemetry bindings.',
    metricsLine: 'Template Schema: MHSA Sec. 11 · Auto-TOC · Executive Summary',
  },
  {
    id: 'spreadsheet',
    label: 'Mining Yield & Cost Spreadsheet Modeler',
    templateTitle: 'Dense Medium Plant Recovery & Cost per Tonne Model',
    description:
      'Model ROM coal feed tonnage, dense-medium cyclone cut-point density, reagent burn rate, and ZAR/tonne operating margin.',
    metricsLine: 'Formula Engine: Live Yield Ledger · CSV & Spreadsheet Export Ready',
  },
  {
    id: 'presentation',
    label: 'Executive Shift Presentation Deck',
    templateTitle: 'Weekly Boardroom Operations & Fleet Availability Deck',
    description:
      'Generate 16:9 boardroom briefing packs combining Control Room SCADA telemetry, haulage availability, and gate muster compliance.',
    metricsLine: 'Slide Deck: Executive KPI Bindings · PDF & Markdown Export Ready',
  },
];

const EXPORT_FORMATS: ReadonlyArray<{
  readonly format: OfficeExportFormat;
  readonly label: string;
}> = [
  { format: 'pdf', label: 'Download PDF (.pdf)' },
  { format: 'csv', label: 'Download CSV (.csv)' },
  { format: 'md', label: 'Download Markdown (.md)' },
  { format: 'json', label: 'Download JSON (.json)' },
];

const SEED_OFFICE_DOCUMENTS: readonly OfficeDocumentRecord[] = [
  {
    id: SOP_DOCUMENT_ID,
    title: 'Executive Shift Handover & Safety Escalation SOP',
    docType: 'document',
    summary:
      'Standard operating procedure for cross-department shift handover, statutory safety sign-off, and control room escalation.',
    updatedAt: '2026-11-02T06:00:00.000Z',
    authorRole: 'Mine Operations Superintendent',
  },
  {
    id: 'office-sheet-yield-cost-model',
    title: 'Plant Dense Medium Yield & Cost per Tonne Model',
    docType: 'spreadsheet',
    summary:
      'Live financial and metallurgical spreadsheet modeling ROM feed tonnage, magnetite consumption, and washed coal yield targets.',
    updatedAt: '2026-11-02T07:30:00.000Z',
    authorRole: 'Senior Cost Accountant',
  },
  {
    id: 'office-deck-weekly-board-review',
    title: 'Weekly Executive Operations & Fleet Availability Deck',
    docType: 'presentation',
    summary:
      'Boardroom presentation summarizing 13-department KPIs, haulage availability, drilling meterage, and gate muster compliance.',
    updatedAt: '2026-11-02T08:15:00.000Z',
    authorRole: 'General Mine Manager',
  },
];

function mergeDocumentLists(
  primaryList: readonly OfficeDocumentRecord[],
  secondaryList: readonly OfficeDocumentRecord[]
): readonly OfficeDocumentRecord[] {
  const seenIds = new Set<string>();
  const merged: OfficeDocumentRecord[] = [];
  for (const record of [...primaryList, ...secondaryList]) {
    if (seenIds.has(record.id)) continue;
    seenIds.add(record.id);
    merged.push(record);
  }
  return merged;
}

export function OfficeWorkspaceClient({
  mode = 'dashboard',
  today,
  initialDocuments,
}: OfficeWorkspaceClientProps) {
  const [activeGenOfficeTab, setActiveGenOfficeTab] = useState<OfficeDocumentType>('document');
  const [documentsList, setDocumentsList] = useState<readonly OfficeDocumentRecord[]>(() =>
    initialDocuments && initialDocuments.length > 0
      ? [...initialDocuments]
      : [...SEED_OFFICE_DOCUMENTS]
  );
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<OfficeSopLiveReportData | null>(
    null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  const [draftTitle, setDraftTitle] = useState<string>(
    'Shift Executive Briefing & Cost Reconciliation'
  );
  const [draftDocType, setDraftDocType] = useState<OfficeDocumentType>('document');
  const [draftExportFormat, setDraftExportFormat] = useState<OfficeExportFormat>('pdf');
  const [draftSummary, setDraftSummary] = useState<string>(
    'Consolidated ROM coal production, wash plant dense-medium recovery, and shift engineering handover notes.'
  );
  const [isSavingDocument, setIsSavingDocument] = useState<boolean>(false);
  const [activeExportFormat, setActiveExportFormat] = useState<OfficeExportFormat | null>(null);
  const [saveFeedbackMessage, setSaveFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const hydrateWorkspace = async () => {
      let localStored: readonly OfficeDocumentRecord[] = [];
      if (typeof window !== 'undefined') {
        try {
          const storedRaw = window.localStorage.getItem(OFFICE_DOCUMENTS_STORAGE_KEY);
          if (storedRaw) {
            const parsedRecords = JSON.parse(storedRaw) as OfficeDocumentRecord[];
            if (Array.isArray(parsedRecords)) {
              localStored = parsedRecords;
            }
          }
        } catch {
          // Ignore storage read restrictions in sandboxed environments
        }
      }

      if (localStored.length > 0 && !isCancelled) {
        setDocumentsList((prev) => mergeDocumentLists(localStored, prev));
      }

      try {
        const snapshot = await getOfficeWorkspaceSnapshot();
        if (!isCancelled && snapshot.documents.length > 0) {
          setDocumentsList((prev) => mergeDocumentLists(snapshot.documents, prev));
        }
      } catch {
        // Fallback cleanly to seeded + local records when offline
      }
    };

    void hydrateWorkspace();
    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedTabDescriptor =
    GENOFFICE_TABS.find((tab) => tab.id === activeGenOfficeTab) ?? GENOFFICE_TABS[0]!;

  const selectedDocument = documentsList.find((doc) => doc.id === selectedDocId) ?? null;

  const loadDocumentPreview = useCallback(async (docEntry: OfficeDocumentRecord) => {
    setSelectedDocId(docEntry.id);
    setIsLoadingPreview(true);
    try {
      const liveReportData = await getOfficeSopLiveReportData({
        documentId: docEntry.id,
        documentTitle: docEntry.title,
        documentSummary: docEntry.summary,
        documentType: docEntry.docType,
        authorRole: docEntry.authorRole,
        updatedAt: docEntry.updatedAt,
      });
      setSelectedReportData(liveReportData);
      return liveReportData;
    } catch {
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  async function handleSelectArtifactCard(docEntry: OfficeDocumentRecord) {
    setSaveFeedbackMessage(null);
    setActiveGenOfficeTab(docEntry.docType);
    const loadedReport = await loadDocumentPreview(docEntry);
    if (loadedReport) {
      setSaveFeedbackMessage(
        `Loaded "${docEntry.title}" for live preview and multi-format export (${loadedReport.operationalDate}).`
      );
    } else {
      setSaveFeedbackMessage(`Selected "${docEntry.title}" — ready for review.`);
    }
  }

  async function handleDownloadSelectedFormat(format: OfficeExportFormat) {
    if (!selectedDocument) return;
    setActiveExportFormat(format);
    try {
      const reportData =
        selectedReportData ??
        (await getOfficeSopLiveReportData({
          documentId: selectedDocument.id,
          documentTitle: selectedDocument.title,
          documentSummary: selectedDocument.summary,
          documentType: selectedDocument.docType,
          authorRole: selectedDocument.authorRole,
          updatedAt: selectedDocument.updatedAt,
        }));
      setSelectedReportData(reportData);

      const exportResult = await downloadOfficeArtifactFile({
        document: selectedDocument,
        reportData,
        format,
      });

      if (exportResult.didDownload) {
        setSaveFeedbackMessage(
          `Saved ${format.toUpperCase()} file "${exportResult.fileName}" to device.`
        );
      } else {
        setSaveFeedbackMessage(
          `Could not export ${format.toUpperCase()} for "${selectedDocument.title}".`
        );
      }
    } finally {
      setActiveExportFormat(null);
    }
  }

  async function handleSaveOfficeDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingDocument(true);
    setSaveFeedbackMessage(null);

    const trimmedTitle = draftTitle.trim();
    const trimmedSummary = draftSummary.trim();
    const optimisticRecord: OfficeDocumentRecord = {
      id: `office-${draftDocType}-${Date.now()}`,
      title: trimmedTitle,
      docType: draftDocType,
      summary: trimmedSummary,
      updatedAt: new Date().toISOString(),
      authorRole: 'Office Suite Operator',
    };

    try {
      const actionResult = await saveOfficeDocumentAction({
        title: trimmedTitle,
        docType: draftDocType,
        summary: trimmedSummary,
      });

      const recordToPersist =
        actionResult.status === 'success' ? actionResult.document : optimisticRecord;
      const updatedRecords = mergeDocumentLists([recordToPersist], documentsList);
      setDocumentsList(updatedRecords);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(OFFICE_DOCUMENTS_STORAGE_KEY, JSON.stringify(updatedRecords));
        } catch {
          // Ignore storage quota errors
        }
      }

      const liveReportData = await loadDocumentPreview(recordToPersist);
      const exportPayload =
        liveReportData ??
        (await getOfficeSopLiveReportData({
          documentId: recordToPersist.id,
          documentTitle: recordToPersist.title,
          documentSummary: recordToPersist.summary,
          documentType: recordToPersist.docType,
          authorRole: recordToPersist.authorRole,
          updatedAt: recordToPersist.updatedAt,
        }));

      const exportResult = await downloadOfficeArtifactFile({
        document: recordToPersist,
        reportData: exportPayload,
        format: draftExportFormat,
      });

      const syncSummary =
        actionResult.status === 'success'
          ? `Saved "${recordToPersist.title}" (${actionResult.documentId})`
          : `Saved local artifact "${recordToPersist.title}"`;
      const downloadNote = exportResult.didDownload
        ? ` and saved ${exportResult.fileName} to device`
        : '';

      setSaveFeedbackMessage(`${syncSummary}${downloadNote}.`);
    } catch {
      const updatedRecords = mergeDocumentLists([optimisticRecord], documentsList);
      setDocumentsList(updatedRecords);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(OFFICE_DOCUMENTS_STORAGE_KEY, JSON.stringify(updatedRecords));
        } catch {
          // Ignore storage quota errors
        }
      }
      setSaveFeedbackMessage(`Saved local artifact "${optimisticRecord.title}".`);
    } finally {
      setIsSavingDocument(false);
    }
  }

  return (
    <div className="space-y-6" data-testid={`office-workspace-${mode}`}>
      {/* Header Card */}
      <GlassCard className="gold-steel-border gold-steel-border-slim p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Briefcase className="h-6 w-6 text-[var(--accent-blue)]" />
              <h2 className="font-bold text-2xl text-[var(--text-heading)] tracking-tight">
                Office Department & AI Productivity Suite
              </h2>
              <Badge variant="blue" size="sm">
                {mode.toUpperCase()}
              </Badge>
            </div>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Enterprise document authoring, metallurgical cost modeling, and multi-format executive
              export for shift date{' '}
              <time dateTime={today} className="font-mono font-semibold text-[var(--text-heading)]">
                {today}
              </time>
              .
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-[var(--border-subtle)] border-t pt-4">
          {OFFICE_QUICK_LINKS.map((routeLink) => (
            <Link key={routeLink.href} href={routeLink.href} className={GOLD_PILL_LINK_CLASS}>
              <span>{routeLink.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            </Link>
          ))}
        </div>
      </GlassCard>

      {/* Panel Header: GenOffice Online AI Suite & Artifact Studio */}
      <div data-testid="genoffice-studio-header-panel" className={GOLD_STUDIO_HEADER_CLASS}>
        <div className="flex items-center gap-2.5">
          <span className="gold-steel-border gold-steel-border-slim flex h-8 w-8 items-center justify-center rounded-xl border border-accent-gold/65 bg-white text-accent-gold shadow-2xs">
            <Sparkles className="h-4 w-4 text-accent-gold" aria-hidden="true" />
          </span>
          <div>
            <span className="block font-anurati font-bold text-slate-950 text-xs tracking-[0.12em]">
              GENOFFICE ONLINE AI SUITE & ARTIFACT STUDIO
            </span>
            <span className="block text-[11px] text-slate-600">
              Select any executive artifact to preview live Supabase telemetry and export to your
              device
            </span>
          </div>
        </div>
        <Badge variant="green" size="sm">
          Online Studio Active
        </Badge>
      </div>

      {/* 1. GenOffice Online Suite Panel */}
      <GlassCard
        className="gold-steel-border gold-steel-border-slim p-5"
        data-testid="genoffice-suite-panel"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
              <FileText className="h-5 w-5 text-[var(--accent-blue)]" />
              GenOffice Online Suite
            </h3>
            <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
              AI-assisted document authoring, mining yield & cost spreadsheets, and boardroom shift
              presentations.
            </p>
          </div>
          <a
            href={GENOFFICE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={GOLD_PILL_LINK_CLASS}
          >
            <span>genspark-ai/genoffice</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
          </a>
        </div>

        {/* Interactive Workspace Tabs */}
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="GenOffice Suite Tabs">
          {GENOFFICE_TABS.map((tabEntry) => {
            const isSelectedTab = tabEntry.id === activeGenOfficeTab;
            return (
              <button
                key={tabEntry.id}
                type="button"
                role="tab"
                aria-selected={isSelectedTab}
                onClick={() => {
                  setActiveGenOfficeTab(tabEntry.id);
                  setDraftDocType(tabEntry.id);
                  setDraftExportFormat(tabEntry.id === 'spreadsheet' ? 'csv' : 'pdf');
                }}
                className={cn(GOLD_PILL_LINK_CLASS, isSelectedTab && 'ring-2 ring-accent-gold/55')}
              >
                {tabEntry.id === 'document' && (
                  <FileText className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                )}
                {tabEntry.id === 'spreadsheet' && (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-accent-green" />
                )}
                {tabEntry.id === 'presentation' && (
                  <Presentation className="h-3.5 w-3.5 text-accent-amber" />
                )}
                <span>{tabEntry.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Workspace Split: Artifact List + Interactive Create/Save Form */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={GOLD_PANEL_CARD_CLASS}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--accent-blue)] text-xs uppercase tracking-wider">
                {selectedTabDescriptor.label}
              </span>
              <Badge variant="green" size="sm">
                Active Template
              </Badge>
            </div>
            <h4 className="mt-2 font-bold text-[var(--text-heading)] text-base">
              {selectedTabDescriptor.templateTitle}
            </h4>
            <p className="mt-1 text-[var(--text-secondary)] text-xs">
              {selectedTabDescriptor.description}
            </p>
            <p className="mt-3 font-mono text-[11px] text-[var(--text-muted)]">
              {selectedTabDescriptor.metricsLine}
            </p>

            <div className="mt-4 space-y-2 border-[var(--border-subtle)] border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--text-heading)] text-xs">
                  Recent Executive Artifacts ({documentsList.length})
                </span>
                <span className="font-mono text-[10px] text-[var(--accent-blue)]">
                  Click any artifact to preview & download
                </span>
              </div>

              {documentsList.map((docEntry) => {
                const isSopTemplate = docEntry.id === SOP_DOCUMENT_ID;
                const isSelectedDoc = selectedDocId === docEntry.id;

                return (
                  <button
                    key={docEntry.id}
                    type="button"
                    data-testid={`office-doc-card-${docEntry.id}`}
                    aria-pressed={isSelectedDoc}
                    aria-label={`Select and review ${docEntry.title}`}
                    onClick={() => void handleSelectArtifactCard(docEntry)}
                    className={
                      isSelectedDoc ? ARTIFACT_CARD_ACTIVE_CLASS : ARTIFACT_CARD_DEFAULT_CLASS
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--text-heading)]">
                        <span>{docEntry.title}</span>
                      </div>
                      <div className="mt-0.5 text-[var(--text-secondary)]">{docEntry.summary}</div>
                      <div className="mt-1.5 inline-flex items-center gap-1 font-medium text-[11px] text-[var(--accent-blue)]">
                        <Eye className="h-3 w-3" />
                        <span>
                          {isSelectedDoc
                            ? 'Active in Document Review Panel'
                            : 'Open Preview & Export Controls'}
                        </span>
                      </div>
                    </div>
                    <Badge variant={isSopTemplate ? 'green' : 'blue'} size="sm">
                      {docEntry.docType}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Create / Save Office Artifact Form */}
          <form onSubmit={handleSaveOfficeDocument} className={GOLD_PANEL_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[var(--text-heading)] text-sm">
                Create & Sync Office Artifact
              </h4>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {OFFICE_DOCUMENTS_STORAGE_KEY}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="office-doc-title"
                  className="block font-semibold text-[var(--text-heading)] text-xs"
                >
                  Artifact Title
                </label>
                <input
                  id="office-doc-title"
                  name="title"
                  type="text"
                  required
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className={GOLD_INPUT_CONTROL_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="office-doc-type"
                    className="block font-semibold text-[var(--text-heading)] text-xs"
                  >
                    Artifact Modality
                  </label>
                  <select
                    id="office-doc-type"
                    name="docType"
                    value={draftDocType}
                    onChange={(event) => {
                      const nextType = event.target.value as OfficeDocumentType;
                      setDraftDocType(nextType);
                      setDraftExportFormat(nextType === 'spreadsheet' ? 'csv' : 'pdf');
                    }}
                    className={GOLD_INPUT_CONTROL_CLASS}
                  >
                    <option value="document">AI Document Writer (document)</option>
                    <option value="spreadsheet">
                      Mining Yield & Cost Spreadsheet Modeler (spreadsheet)
                    </option>
                    <option value="presentation">
                      Executive Shift Presentation Deck (presentation)
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="office-doc-export-format"
                    className="block font-semibold text-[var(--text-heading)] text-xs"
                  >
                    Device Save Format
                  </label>
                  <select
                    id="office-doc-export-format"
                    name="exportFormat"
                    value={draftExportFormat}
                    onChange={(event) =>
                      setDraftExportFormat(event.target.value as OfficeExportFormat)
                    }
                    className={GOLD_INPUT_CONTROL_CLASS}
                  >
                    <option value="pdf">Live PDF Report (.pdf)</option>
                    <option value="csv">Spreadsheet CSV (.csv)</option>
                    <option value="md">Markdown Document (.md)</option>
                    <option value="json">Structured JSON (.json)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="office-doc-summary"
                  className="block font-semibold text-[var(--text-heading)] text-xs"
                >
                  Executive Summary & KPI Scope
                </label>
                <textarea
                  id="office-doc-summary"
                  name="summary"
                  rows={3}
                  required
                  value={draftSummary}
                  onChange={(event) => setDraftSummary(event.target.value)}
                  className={GOLD_INPUT_CONTROL_CLASS}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSavingDocument}
                  className={GOLD_PRIMARY_BTN_CLASS}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {isSavingDocument
                      ? 'Saving & Exporting...'
                      : 'Save Artifact & Download to Device'}
                  </span>
                </button>

                {saveFeedbackMessage && (
                  <span
                    role="status"
                    className="flex items-center gap-1 font-medium text-accent-green text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{saveFeedbackMessage}</span>
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Interactive Selected Document Review & Multi-Format Export Panel */}
        {selectedDocument && (
          <div
            data-testid="selected-office-document-preview"
            className={cn(GOLD_PANEL_CARD_CLASS, 'mt-4 space-y-4')}
          >
            <div className="flex flex-col justify-between gap-3 border-slate-200 border-b pb-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
                    Selected Document Review
                  </span>
                  <Badge variant="blue" size="sm">
                    {selectedDocument.docType}
                  </Badge>
                  {selectedReportData && (
                    <Badge
                      variant={
                        selectedReportData.dataSourceStatus === 'live_supabase' ? 'green' : 'amber'
                      }
                      size="sm"
                    >
                      {selectedReportData.dataSourceStatus === 'live_supabase'
                        ? 'LIVE SUPABASE SYNC'
                        : 'TEMPLATE BASELINE'}
                    </Badge>
                  )}
                </div>
                <h4 className="mt-1 font-bold text-base text-slate-950">
                  {selectedDocument.title}
                </h4>
                <p className="mt-0.5 text-slate-600 text-xs">{selectedDocument.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {EXPORT_FORMATS.map(({ format, label }) => {
                  const isBusy = activeExportFormat === format;
                  return (
                    <button
                      key={format}
                      type="button"
                      disabled={activeExportFormat !== null || isLoadingPreview}
                      onClick={() => void handleDownloadSelectedFormat(format)}
                      className={GOLD_EXPORT_BTN_CLASS}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : format === 'json' || format === 'md' ? (
                        <FileCode2 className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                      )}
                      <span>{isBusy ? 'Exporting...' : label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoadingPreview && !selectedReportData ? (
              <div className="flex items-center gap-2 py-4 font-mono text-slate-600 text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-blue)]" />
                <span>Syncing live Supabase telemetry for preview...</span>
              </div>
            ) : selectedReportData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-mono text-[10px] text-slate-500 uppercase">
                      Active Breakdowns
                    </div>
                    <div className="mt-0.5 font-bold font-mono text-base text-slate-950">
                      {selectedReportData.activeBreakdownsCount}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {selectedReportData.recent24hBreakdownsCount} logged in 24h
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-mono text-[10px] text-slate-500 uppercase">
                      Fleet Tires
                    </div>
                    <div className="mt-0.5 font-bold font-mono text-base text-slate-950">
                      {selectedReportData.installedTiresCount}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {selectedReportData.criticalTiresCount} critical alerts
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-mono text-[10px] text-slate-500 uppercase">
                      Site Visitors
                    </div>
                    <div className="mt-0.5 font-bold font-mono text-base text-slate-950">
                      {selectedReportData.checkedInVisitorsCount}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {selectedReportData.recentAccessScansCount} gate scans
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="font-mono text-[10px] text-slate-500 uppercase">
                      Shift Daily Logs
                    </div>
                    <div className="mt-0.5 font-bold font-mono text-base text-slate-950">
                      {selectedReportData.recentDailyLogsCount}
                    </div>
                    <div className="truncate text-[10px] text-slate-600">
                      {selectedReportData.latestGateEvent}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-900">Latest Shift Handover Note</div>
                  <p className="mt-1 text-slate-700">{selectedReportData.latestShiftNote}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
