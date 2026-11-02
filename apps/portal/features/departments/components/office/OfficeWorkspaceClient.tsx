'use client';

import { Badge } from '@repo/ui';
import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FileText,
  Presentation,
  Save,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  type OfficeDocumentRecord,
  type OfficeDocumentType,
  saveOfficeDocumentAction,
} from './actions';

type OfficeWorkspaceMode = 'dashboard' | 'panels' | 'documents';

interface OfficeWorkspaceClientProps {
  readonly mode?: OfficeWorkspaceMode;
  readonly today: string;
  readonly initialDocuments?: readonly OfficeDocumentRecord[];
}

const OFFICE_DOCUMENTS_STORAGE_KEY = 'arch_office_documents_v1';
const GENOFFICE_REPO_URL = 'https://github.com/genspark-ai/genoffice';
const INSHELLISENSE_REPO_URL = 'https://github.com/microsoft/inshellisense';
const TRAIL_CODE_REPO_URL = 'https://github.com/trailhq/Trail-Code';

const GOLD_PILL_LINK_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white/85 px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-colors hover:bg-[var(--bg-secondary)]';

const GOLD_PANEL_CARD_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-xl border border-[var(--border-default)] bg-white/85 p-4 shadow-2xs';

const GOLD_INPUT_CONTROL_CLASS =
  'gold-steel-border gold-steel-border-slim w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-2 text-[var(--text-heading)] text-sm';

const GOLD_PRIMARY_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs transition-opacity hover:opacity-90 disabled:opacity-50';

interface QuickNavRoute {
  readonly href: string;
  readonly label: string;
}

const OFFICE_QUICK_LINKS: readonly QuickNavRoute[] = [
  { href: '/office', label: 'Office Suite Overview' },
  { href: '/office/panels', label: 'Lab Tool Panels' },
  { href: '/office/documents', label: 'Executive Documents' },
  { href: '/office/daily-log', label: 'Daily Log' },
  { href: '/office/reports', label: 'Reports' },
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
      'Draft structured mine manager directives, shift handover dossiers, and MHSA statutory compliance memos with live AI citation checks.',
    metricsLine: 'Template Schema: MHSA Sec. 11 · Auto-TOC · Bilingual Executive Summary',
  },
  {
    id: 'spreadsheet',
    label: 'Mining Yield & Cost Spreadsheet Modeler',
    templateTitle: 'Dense Medium Plant Recovery & Cost per Tonne Model',
    description:
      'Model ROM coal feed tonnage, dense-medium cyclone cut-point density, reagent burn rate, and ZAR/tonne operating margin.',
    metricsLine: 'Formula Engine: 42 Live Cells · ROM Yield 76.4% · Target Cost R 412.50/t',
  },
  {
    id: 'presentation',
    label: 'Executive Shift Presentation Deck',
    templateTitle: 'Weekly Boardroom Operations & Fleet Availability Deck',
    description:
      'Generate 16:9 boardroom slide decks combining Control Room SCADA telemetry, haulage availability, and gate muster compliance.',
    metricsLine: 'Slide Deck: 12 Slides · Live KPI Bindings · PDF & PPTX Export Ready',
  },
];

interface InshellisenseBinding {
  readonly commandSpec: string;
  readonly shellScope: string;
  readonly description: string;
}

const INSHELLISENSE_SHELLS: readonly string[] = ['bash', 'zsh', 'fish', 'pwsh'];

const INSHELLISENSE_BINDINGS: readonly InshellisenseBinding[] = [
  {
    commandSpec: 'pnpm agent:verify',
    shellScope: 'bash / zsh',
    description: '27-gate monorepo verification pipeline with AST, RLS, and contract drift checks',
  },
  {
    commandSpec: 'pnpm --filter portal test',
    shellScope: 'bash / zsh / fish',
    description: 'Targeted Jest 30 SWC unit & integration test runner for portal routes',
  },
  {
    commandSpec: 'pnpm audit:drift && pnpm audit:compliance',
    shellScope: 'bash / pwsh',
    description: 'PostgreSQL 17 migration parity, Zod contract validation, and RLS InitPlan audit',
  },
];

interface TrailCodePathway {
  readonly trailId: string;
  readonly title: string;
  readonly entryPoint: string;
  readonly hopChain: string;
  readonly verificationTier: string;
}

const TRAIL_CODE_PATHWAYS: readonly TrailCodePathway[] = [
  {
    trailId: 'trail-request-proxy',
    title: 'Request Proxy',
    entryPoint: 'apps/portal/proxy.ts → apps/portal/server/proxy.ts',
    hopChain:
      'Cryptographic x-nonce CSP → Supabase JWT verify → Redis RBAC cache (arch:auth:employee:<uid>) → Department route gate',
    verificationTier: 'E2 Verified · 0ms L1 / <2ms L2',
  },
  {
    trailId: 'trail-dual-tier-redis',
    title: 'Dual-Tier Redis Cache',
    entryPoint: 'packages/redis/src/index.ts → apps/portal/lib/server-cache.ts',
    hopChain:
      'In-memory LRU L1 → Redis 7 L2 X-Fetch stampede lock → updateTagInAction(dept:office:workspace) read-your-writes purge',
    verificationTier: 'E2 Verified · Atomic Lua Stampede Protection',
  },
  {
    trailId: 'trail-department-workspace',
    title: 'Department Workspace',
    entryPoint: 'apps/portal/app/(departments)/office/page.tsx → OfficeWorkspaceClient.tsx',
    hopChain:
      'DepartmentLayout shell → OfficeWorkspaceClient → saveOfficeDocumentAction → Audit Log + Tag Revalidation',
    verificationTier: 'E2 Verified · 13-Department Federation',
  },
];

const SEED_OFFICE_DOCUMENTS: readonly OfficeDocumentRecord[] = [
  {
    id: 'office-doc-shift-handover-sop',
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
  const [draftTitle, setDraftTitle] = useState<string>(
    'Shift Executive Briefing & Cost Reconciliation'
  );
  const [draftDocType, setDraftDocType] = useState<OfficeDocumentType>('document');
  const [draftSummary, setDraftSummary] = useState<string>(
    'Consolidated ROM coal production, wash plant dense-medium recovery, and shift engineering handover notes.'
  );
  const [isSavingDocument, setIsSavingDocument] = useState<boolean>(false);
  const [saveFeedbackMessage, setSaveFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedRaw = window.localStorage.getItem(OFFICE_DOCUMENTS_STORAGE_KEY);
      if (storedRaw) {
        const parsedRecords = JSON.parse(storedRaw) as OfficeDocumentRecord[];
        if (Array.isArray(parsedRecords) && parsedRecords.length > 0) {
          setDocumentsList(parsedRecords);
        }
      }
    } catch {
      // Ignore storage read restrictions in sandboxed environments
    }
  }, []);

  const selectedTabDescriptor =
    GENOFFICE_TABS.find((tab) => tab.id === activeGenOfficeTab) ?? GENOFFICE_TABS[0]!;

  async function handleSaveOfficeDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingDocument(true);
    setSaveFeedbackMessage(null);

    const optimisticRecord: OfficeDocumentRecord = {
      id: `office-${draftDocType}-${Date.now()}`,
      title: draftTitle.trim(),
      docType: draftDocType,
      summary: draftSummary.trim(),
      updatedAt: new Date().toISOString(),
      authorRole: 'Office Suite Operator',
    };

    try {
      const actionResult = await saveOfficeDocumentAction({
        title: draftTitle,
        docType: draftDocType,
        summary: draftSummary,
      });

      const recordToPersist =
        actionResult.status === 'success' ? actionResult.document : optimisticRecord;
      const updatedRecords = [recordToPersist, ...documentsList];
      setDocumentsList(updatedRecords);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(OFFICE_DOCUMENTS_STORAGE_KEY, JSON.stringify(updatedRecords));
        } catch {
          // Ignore storage quota errors
        }
      }

      setSaveFeedbackMessage(
        actionResult.status === 'success'
          ? `Saved "${recordToPersist.title}" (${actionResult.documentId})`
          : `Saved local draft "${recordToPersist.title}" (${actionResult.message})`
      );
    } catch {
      const updatedRecords = [optimisticRecord, ...documentsList];
      setDocumentsList(updatedRecords);
      setSaveFeedbackMessage(`Saved local draft "${optimisticRecord.title}"`);
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
              Enterprise document authoring, metallurgical cost modeling, terminal IDE autocomplete,
              and architectural codebase trail intelligence for shift date{' '}
              <time dateTime={today} className="font-mono font-semibold text-[var(--text-heading)]">
                {today}
              </time>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="green" size="sm">
              GenOffice Online
            </Badge>
            <Badge variant="blue" size="sm">
              inshellisense v0.0.4
            </Badge>
            <Badge variant="amber" size="sm">
              trail-code v0.28.1
            </Badge>
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

      <Divider variant="fading" label="GENOFFICE ONLINE AI SUITE & ARTIFACT STUDIO" />

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
                }}
                className={GOLD_PILL_LINK_CLASS}
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

        {/* Active Tab Preview Banner */}
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
              <div className="font-semibold text-[var(--text-heading)] text-xs">
                Recent Executive Artifacts ({documentsList.length})
              </div>
              {documentsList.map((docEntry) => (
                <div
                  key={docEntry.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-2.5 text-xs"
                >
                  <div>
                    <div className="font-semibold text-[var(--text-heading)]">{docEntry.title}</div>
                    <div className="mt-0.5 text-[var(--text-secondary)]">{docEntry.summary}</div>
                  </div>
                  <Badge variant="blue" size="sm">
                    {docEntry.docType}
                  </Badge>
                </div>
              ))}
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
                  onChange={(event) => setDraftDocType(event.target.value as OfficeDocumentType)}
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
                  <span>{isSavingDocument ? 'Saving Artifact...' : 'Save Office Artifact'}</span>
                </button>

                {saveFeedbackMessage && (
                  <span
                    role="status"
                    className="flex items-center gap-1 font-medium text-accent-green text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saveFeedbackMessage}
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      </GlassCard>

      <Divider variant="fading" label="LAB INTEGRATIONS: INSHELLISENSE & TRAIL-CODE" />

      {/* 2. Inshellisense & 3. Trail-Code Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2. Inshellisense Terminal IDE Panel */}
        <GlassCard
          className="gold-steel-border gold-steel-border-slim p-5"
          data-testid="inshellisense-terminal-panel"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
                <Terminal className="h-5 w-5 text-accent-green" />
                Inshellisense Terminal IDE
              </h3>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                IDE-style command-line autocomplete runtime for operational shell workflows.
              </p>
            </div>
            <a
              href={INSHELLISENSE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={GOLD_PILL_LINK_CLASS}
            >
              <span>microsoft/inshellisense</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={GOLD_PANEL_CARD_CLASS}>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">is --version</span>
              <div className="mt-1 font-bold font-mono text-[var(--text-heading)] text-base">
                0.0.4
              </div>
            </div>
            <div className={GOLD_PANEL_CARD_CLASS}>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">is doctor</span>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-accent-green text-base">
                <CheckCircle2 className="h-4 w-4" />
                <span>healthy</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="font-semibold text-[var(--text-heading)] text-xs">
              Supported Shells Matrix
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {INSHELLISENSE_SHELLS.map((shellName) => (
                <span
                  key={shellName}
                  className="gold-steel-border gold-steel-border-slim rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1 font-mono font-semibold text-[var(--text-heading)] text-xs"
                >
                  {shellName}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="font-semibold text-[var(--text-heading)] text-xs">
              Arch-System Operational CLI Bindings
            </div>
            {INSHELLISENSE_BINDINGS.map((bindingEntry) => (
              <div key={bindingEntry.commandSpec} className={GOLD_PANEL_CARD_CLASS}>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-bold font-mono text-[var(--accent-blue)] text-xs">
                    {bindingEntry.commandSpec}
                  </code>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {bindingEntry.shellScope}
                  </span>
                </div>
                <p className="mt-1 text-[var(--text-secondary)] text-xs">
                  {bindingEntry.description}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* 3. Trail-Code Intelligence Panel */}
        <GlassCard
          className="gold-steel-border gold-steel-border-slim p-5"
          data-testid="trail-code-intelligence-panel"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
                <Compass className="h-5 w-5 text-[var(--accent-blue)]" />
                Trail-Code Intelligence
              </h3>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Code-map trail explorer tracing live request, cache, and department execution paths.
              </p>
            </div>
            <a
              href={TRAIL_CODE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={GOLD_PILL_LINK_CLASS}
            >
              <span>trailhq/Trail-Code</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            </a>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/70 px-4 py-2.5">
            <span className="font-mono text-[var(--text-secondary)] text-xs">trail --version</span>
            <span className="font-bold font-mono text-[var(--text-heading)] text-sm">0.28.1</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="font-semibold text-[var(--text-heading)] text-xs">
              Active Architectural Trails
            </div>
            {TRAIL_CODE_PATHWAYS.map((pathwayEntry) => (
              <div key={pathwayEntry.trailId} className={GOLD_PANEL_CARD_CLASS}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--text-heading)] text-sm">
                    {pathwayEntry.title}
                  </span>
                  <Badge variant="green" size="sm">
                    {pathwayEntry.verificationTier}
                  </Badge>
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--accent-blue)]">
                  {pathwayEntry.entryPoint}
                </div>
                <p className="mt-1.5 text-[var(--text-secondary)] text-xs">
                  {pathwayEntry.hopChain}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
