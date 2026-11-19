'use client';

import type {
  AgentCompletionState,
  AgentPerformanceMetrics,
  AgentVerificationReport,
  CategoryScore,
  CheckStatus,
  QualityCheckResult,
  QualityRunEvidence,
  RegressionFinding,
  ReleaseCertification,
  ReleaseStatus,
  ScoringCategory,
  Severity,
} from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Download,
  FileCode2,
  FileJson,
  FileText,
  Filter,
  GitBranch,
  GitCommit,
  Lock,
  Network,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Public API Types
// ---------------------------------------------------------------------------

export interface QualityIntelligenceApiResponse {
  readonly success?: boolean;
  readonly latestRun: QualityRunEvidence | null;
  readonly runs: readonly QualityRunEvidence[];
  readonly agentReports: readonly AgentVerificationReport[];
  readonly agentPerformance?: readonly AgentPerformanceMetrics[];
  readonly agentMetrics?: readonly AgentPerformanceMetrics[];
  readonly latestCertification?: ReleaseCertification | null;
  readonly releaseCertification?: ReleaseCertification | null;
  readonly certifications?: readonly ReleaseCertification[];
  readonly canCertify: boolean;
  readonly source?: string;
  readonly loadedAt?: string;
  readonly unavailableReasons?: readonly string[];
  readonly markdownReport?: string;
}

export interface QualityIntelligenceFilters {
  readonly agent: string;
  readonly department: string;
  readonly packageName: string;
  readonly branch: string;
  readonly commit: string;
  readonly pullRequest: string;
  readonly severity: string;
  readonly date: string;
  readonly status: string;
}

type DrillDownTarget =
  | { readonly kind: 'check'; readonly item: QualityCheckResult }
  | { readonly kind: 'regression'; readonly item: RegressionFinding };

// ---------------------------------------------------------------------------
// Constants & Lookup Dictionaries
// ---------------------------------------------------------------------------

const QUALITY_INTELLIGENCE_ENDPOINT = '/api/control-room/quality-intelligence';
const QUALITY_CERTIFY_ENDPOINT = '/api/control-room/quality-intelligence/certify';
const CERTIFICATION_PASS_FLOOR = 90;
const WARNING_SCORE_FLOOR = 70;
const MAX_RECENT_RUNS_TREND = 5;
const PERCENT_DIVISOR = 100;
const DIGEST_PREVIEW_LENGTH = 16;
const SHA_PREVIEW_LENGTH = 10;
const MS_PER_SECOND = 1000;

const INITIAL_FILTERS: QualityIntelligenceFilters = {
  agent: '',
  department: '',
  packageName: '',
  branch: '',
  commit: '',
  pullRequest: '',
  severity: '',
  date: '',
  status: '',
};

const SCORING_CATEGORY_META: Readonly<
  Record<ScoringCategory, { readonly label: string; readonly weightPct: number }>
> = {
  security: { label: 'Security', weightPct: 20 },
  functional_testing: { label: 'Functional Testing', weightPct: 20 },
  architecture: { label: 'Architecture', weightPct: 15 },
  reliability: { label: 'Reliability', weightPct: 15 },
  performance: { label: 'Performance', weightPct: 10 },
  database_integrity: { label: 'Database Integrity', weightPct: 10 },
  accessibility_ux: { label: 'Accessibility & UX', weightPct: 5 },
  documentation_governance: { label: 'Documentation & Governance', weightPct: 5 },
};

const ORDERED_SCORING_CATEGORIES: readonly ScoringCategory[] = [
  'security',
  'functional_testing',
  'architecture',
  'reliability',
  'performance',
  'database_integrity',
  'accessibility_ux',
  'documentation_governance',
];

const CHECK_STATUS_BADGE_MAP: Readonly<Record<CheckStatus, string>> = {
  PASSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  SKIPPED: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  UNAVAILABLE: 'border-amber-200 bg-amber-50 text-amber-700',
  BLOCKED: 'border-rose-300 bg-rose-100 text-rose-800',
};

const SEVERITY_BADGE_MAP: Readonly<Record<Severity, string>> = {
  CRITICAL: 'border-rose-300 bg-rose-100 text-rose-800',
  HIGH: 'border-rose-200 bg-rose-50 text-rose-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  LOW: 'border-sky-200 bg-sky-50 text-sky-700',
  INFO: 'border-zinc-200 bg-zinc-100 text-zinc-700',
};

const AGENT_STATE_BADGE_MAP: Readonly<Record<AgentCompletionState, string>> = {
  NOT_STARTED: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  IN_PROGRESS: 'border-sky-200 bg-sky-50 text-sky-700',
  IMPLEMENTATION_COMPLETE: 'border-sky-200 bg-sky-50 text-sky-700',
  VERIFICATION_PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  VERIFICATION_PASSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  VERIFICATION_FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  BLOCKED: 'border-rose-300 bg-rose-100 text-rose-800',
  REQUIRES_HUMAN_APPROVAL: 'border-amber-300 bg-amber-100 text-amber-800',
};

const RELEASE_STATUS_BADGE_MAP: Readonly<Record<ReleaseStatus, string>> = {
  NOT_READY: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  READY_FOR_REVIEW: 'border-sky-200 bg-sky-50 text-sky-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  BLOCKED: 'border-rose-300 bg-rose-100 text-rose-800',
  RELEASED: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  ROLLBACK_REQUIRED: 'border-rose-300 bg-rose-100 text-rose-800',
};

// ---------------------------------------------------------------------------
// Shared Style Constants (kept <= 12 utilities per element for Tailwind audit)
// ---------------------------------------------------------------------------

const SECTION_HEADING_CLASS = 'font-semibold text-base text-[var(--text-heading)]';
const SECTION_SUBTEXT_CLASS = 'text-xs text-[var(--text-secondary)]';
const CARD_SURFACE_CLASS =
  'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-3';
const FILTER_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs text-[var(--text-heading)]';
const ACTION_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-xs text-[var(--text-heading)] transition-colors hover:bg-[var(--bg-tertiary)]';
const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 font-semibold text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50';
const BADGE_BASE_CLASS =
  'inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[11px]';
const TABLE_HEADER_CLASS =
  'px-3 py-2 text-left font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wide';
const TABLE_CELL_CLASS = 'px-3 py-2.5 text-xs text-[var(--text-primary)] align-top';
const DRILL_DOWN_ROW_CLASS =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-left transition-colors hover:border-[var(--accent-blue)]';

// ---------------------------------------------------------------------------
// Pure Helpers
// ---------------------------------------------------------------------------

function buildQueryUrl(filters: QualityIntelligenceFilters): string {
  const params = new URLSearchParams();
  if (filters.agent.trim()) params.set('agent', filters.agent.trim());
  if (filters.department.trim()) params.set('department', filters.department.trim());
  if (filters.packageName.trim()) params.set('package', filters.packageName.trim());
  if (filters.branch.trim()) params.set('branch', filters.branch.trim());
  if (filters.commit.trim()) params.set('commit', filters.commit.trim());
  if (filters.pullRequest.trim()) params.set('pr', filters.pullRequest.trim());
  if (filters.severity.trim()) params.set('severity', filters.severity.trim());
  if (filters.date.trim()) params.set('date', filters.date.trim());
  if (filters.status.trim()) params.set('status', filters.status.trim());
  const qs = params.toString();
  return qs ? `${QUALITY_INTELLIGENCE_ENDPOINT}?${qs}` : QUALITY_INTELLIGENCE_ENDPOINT;
}

async function fetchQualityIntelligence(
  filters: QualityIntelligenceFilters
): Promise<QualityIntelligenceApiResponse> {
  const response = await fetch(buildQueryUrl(filters), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Quality intelligence request failed (${response.status})`);
  }
  return (await response.json()) as QualityIntelligenceApiResponse;
}

interface CertifyApiEnvelope {
  readonly certification?: ReleaseCertification;
  readonly error?: { readonly message?: string };
}

async function postReleaseCertification(payload: {
  readonly commitSha: string;
  readonly evidenceSha256: string;
  readonly notes: string;
}): Promise<ReleaseCertification> {
  const response = await fetch(QUALITY_CERTIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commitSha: payload.commitSha,
      evidenceSha256: payload.evidenceSha256,
      action: 'APPROVE',
      notes: payload.notes.trim() || null,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as CertifyApiEnvelope &
    Partial<ReleaseCertification>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Certification failed (${response.status})`);
  }
  return (body.certification ?? body) as ReleaseCertification;
}

function formatDuration(durationMs: number): string {
  if (durationMs < MS_PER_SECOND) {
    return `${Math.round(durationMs)}ms`;
  }
  return `${(durationMs / MS_PER_SECOND).toFixed(2)}s`;
}

function formatTimestamp(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function buildMarkdownReport(payload: QualityIntelligenceApiResponse): string {
  if (payload.markdownReport && payload.markdownReport.trim().length > 0) {
    return payload.markdownReport;
  }
  const run = payload.latestRun;
  if (!run) {
    return '# Quality Intelligence Report\n\nNo verification run evidence is available.\n';
  }
  const lines: string[] = [
    '# Arch OS Quality Intelligence Report',
    '',
    `- **Run ID:** ${run.runId}`,
    `- **Branch:** ${run.branch}`,
    `- **Commit SHA:** ${run.commitSha}`,
    `- **Executed At:** ${run.executedAt}`,
    `- **Overall Status:** ${run.overallStatus}`,
    `- **Overall Score:** ${run.score.overallScore.toFixed(1)}% (Confidence ${run.score.confidencePct.toFixed(1)}%, Coverage ${run.score.coveragePct.toFixed(1)}%)`,
    `- **Security Risk Level:** ${run.score.securityRiskLevel}`,
    `- **Release Blocked:** ${run.score.releaseBlocked ? 'YES' : 'NO'}`,
    `- **Evidence SHA-256:** ${run.evidenceSha256}`,
    '',
    '## 8-Category Breakdown',
    '',
  ];
  for (const cat of run.score.categoryScores) {
    const meta = SCORING_CATEGORY_META[cat.category];
    lines.push(
      `- **${meta.label} (${meta.weightPct}%):** ${cat.score.toFixed(1)}% (verified=${cat.verified}, failed=${cat.failed}, skipped=${cat.skipped}, unavailable=${cat.unavailable})`
    );
  }
  lines.push('', `## Checks (${run.checks.length})`, '');
  for (const check of run.checks) {
    lines.push(
      `- [${check.status}] **${check.name}** (\`${check.checkId}\`) — ${formatDuration(check.durationMs)}`
    );
  }
  lines.push('', `## Regressions (${run.regressions.length})`, '');
  for (const reg of run.regressions) {
    lines.push(
      `- [${reg.severity}] (${reg.isPreExisting ? 'Pre-existing' : 'New'}) **${reg.id}**: ${reg.difference}`
    );
  }
  return `${lines.join('\n')}\n`;
}

function triggerFileDownload(options: {
  readonly filename: string;
  readonly content: string;
  readonly mimeType: string;
}): void {
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }
  const blob = new Blob([options.content], { type: options.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = options.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function matchesTextFilter(target: string | null | undefined, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (target ?? '').toLowerCase().includes(normalized);
}

// ---------------------------------------------------------------------------
// Reusable Presentational Subcomponents
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { readonly status: CheckStatus }) {
  return <span className={cn(BADGE_BASE_CLASS, CHECK_STATUS_BADGE_MAP[status])}>{status}</span>;
}

function SeverityBadge({ severity }: { readonly severity: Severity }) {
  return <span className={cn(BADGE_BASE_CLASS, SEVERITY_BADGE_MAP[severity])}>{severity}</span>;
}

function AgentStateBadge({ state }: { readonly state: AgentCompletionState }) {
  return <span className={cn(BADGE_BASE_CLASS, AGENT_STATE_BADGE_MAP[state])}>{state}</span>;
}

function ReleaseStatusBadge({ status }: { readonly status: ReleaseStatus }) {
  return <span className={cn(BADGE_BASE_CLASS, RELEASE_STATUS_BADGE_MAP[status])}>{status}</span>;
}

function EmptySectionNotice({ message }: { readonly message: string }) {
  return (
    <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-secondary)] text-xs">
      {message}
    </p>
  );
}

function SectionTitle({
  id,
  icon,
  title,
  subtitle,
  rightSlot,
}: {
  readonly id: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly rightSlot?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h2 id={id} className={SECTION_HEADING_CLASS}>
            {title}
          </h2>
          <p className={SECTION_SUBTEXT_CLASS}>{subtitle}</p>
        </div>
      </div>
      {rightSlot}
    </div>
  );
}

function CategoryScoreCard({ categoryScore }: { readonly categoryScore: CategoryScore }) {
  const meta = SCORING_CATEGORY_META[categoryScore.category];
  const progressBarClass =
    categoryScore.score >= CERTIFICATION_PASS_FLOOR
      ? 'bg-emerald-500'
      : categoryScore.score >= WARNING_SCORE_FLOOR
        ? 'bg-amber-500'
        : 'bg-rose-500';

  return (
    <div className={CARD_SURFACE_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--text-heading)] text-xs">{meta.label}</span>
        <span className="text-[11px] text-[var(--text-secondary)]">{meta.weightPct}% weight</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="font-bold text-[var(--text-heading)] text-lg">
          {categoryScore.score.toFixed(1)}%
        </span>
        <span className="text-[11px] text-[var(--text-secondary)]">
          {categoryScore.verified} pass / {categoryScore.failed} fail
        </span>
      </div>
      <div
        aria-label={`${meta.label} score progress`}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]"
      >
        <div
          className={`h-full rounded-full ${progressBarClass}`}
          style={{ width: `${Math.max(0, Math.min(100, categoryScore.score))}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
        Skipped: {categoryScore.skipped} · Unavailable: {categoryScore.unavailable}
      </p>
    </div>
  );
}

function DrillDownDrawer({
  target,
  onClose,
}: {
  readonly target: DrillDownTarget;
  readonly onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    drawerRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label="Finding Drill-Down Details"
      className="rounded-2xl border border-[var(--accent-blue)]/40 bg-[var(--bg-primary)] p-5 shadow-window focus:outline-none"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            {target.kind === 'check'
              ? `Check Evidence: ${target.item.name}`
              : `Regression Evidence: ${target.item.id}`}
          </h3>
          <p className="text-[var(--text-secondary)] text-xs">
            Press Escape or use Close to dismiss this inspection panel.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close finding details"
          className={ACTION_BUTTON_CLASS}
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      {target.kind === 'check' ? (
        <div className="space-y-2 text-[var(--text-primary)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={target.item.status} />
            <span className={BADGE_BASE_CLASS}>ID: {target.item.checkId}</span>
            <span className={BADGE_BASE_CLASS}>Owner: {target.item.owner}</span>
            <span className={BADGE_BASE_CLASS}>
              Duration: {formatDuration(target.item.durationMs)}
            </span>
            <span className={BADGE_BASE_CLASS}>Exit Code: {target.item.exitCode ?? 'N/A'}</span>
          </div>
          <p>
            <strong className="text-[var(--text-heading)]">Command:</strong>{' '}
            <code className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5">
              {target.item.command}
            </code>
          </p>
          {target.item.skipReason && (
            <p>
              <strong className="text-[var(--text-heading)]">Skip / Block Reason:</strong>{' '}
              {target.item.skipReason}
            </p>
          )}
          {target.item.logExcerpt && (
            <div>
              <strong className="text-[var(--text-heading)]">Redacted Log Excerpt:</strong>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-[11px]">
                {target.item.logExcerpt}
              </pre>
            </div>
          )}
          {target.item.evidenceLinks.length > 0 && (
            <p>
              <strong className="text-[var(--text-heading)]">Evidence Links:</strong>{' '}
              {target.item.evidenceLinks.join(', ')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-[var(--text-primary)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={target.item.severity} />
            <span className={BADGE_BASE_CLASS}>
              {target.item.isPreExisting ? 'Pre-existing Failure' : 'New Regression'}
            </span>
            <span className={BADGE_BASE_CLASS}>Package: {target.item.affectedPackage}</span>
            <span className={BADGE_BASE_CLASS}>Category: {target.item.category}</span>
          </div>
          <p>
            <strong className="text-[var(--text-heading)]">Difference:</strong>{' '}
            {target.item.difference}
          </p>
          <p>
            <strong className="text-[var(--text-heading)]">Comparison:</strong>{' '}
            {target.item.previousResult} -&gt; {target.item.currentResult}
          </p>
          <p>
            <strong className="text-[var(--text-heading)]">Suggested Remediation:</strong>{' '}
            {target.item.suggestedRemediation}
          </p>
          {target.item.affectedFiles.length > 0 && (
            <p>
              <strong className="text-[var(--text-heading)]">Affected Files:</strong>{' '}
              {target.item.affectedFiles.join(', ')}
            </p>
          )}
          {target.item.evidence.length > 0 && (
            <p>
              <strong className="text-[var(--text-heading)]">Evidence References:</strong>{' '}
              {target.item.evidence.join(', ')}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main Console Component
// ---------------------------------------------------------------------------

export function QualityIntelligenceConsole() {
  const baseId = useId();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<QualityIntelligenceFilters>(INITIAL_FILTERS);
  const [drillDown, setDrillDown] = useState<DrillDownTarget | null>(null);
  const [certifyNotes, setCertifyNotes] = useState('');
  const [certifyFeedback, setCertifyFeedback] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['control-room', 'quality-intelligence', filters],
    queryFn: () => fetchQualityIntelligence(filters),
  });

  const certifyMutation = useMutation({
    mutationFn: postReleaseCertification,
    onSuccess: (certified) => {
      setCertifyFeedback(
        `Release certification updated to ${certified.status} for commit ${certified.commitSha.slice(0, SHA_PREVIEW_LENGTH)}.`
      );
      void queryClient.invalidateQueries({
        queryKey: ['control-room', 'quality-intelligence'],
      });
    },
    onError: (err: Error) => {
      setCertifyFeedback(`Certification request failed: ${err.message}`);
    },
  });

  const data = query.data;
  const latestRun = data?.latestRun ?? null;
  const runs = data?.runs ?? [];
  const agentReports = data?.agentReports ?? [];
  const agentMetrics = data?.agentPerformance ?? data?.agentMetrics ?? [];
  const releaseCertification = data?.latestCertification ?? data?.releaseCertification ?? null;
  const canCertify = data?.canCertify === true;
  const unavailableReasons = data?.unavailableReasons ?? [];

  const filteredChecks = useMemo(() => {
    if (!latestRun) return [];
    return latestRun.checks.filter((check) => {
      if (filters.status && check.status !== filters.status) return false;
      if (
        filters.packageName &&
        !matchesTextFilter(check.command, filters.packageName) &&
        !matchesTextFilter(check.owner, filters.packageName)
      ) {
        return false;
      }
      if (
        filters.department &&
        !matchesTextFilter(check.owner, filters.department) &&
        !matchesTextFilter(check.name, filters.department)
      ) {
        return false;
      }
      return true;
    });
  }, [latestRun, filters.status, filters.packageName, filters.department]);

  const filteredRegressions = useMemo(() => {
    if (!latestRun) return [];
    return latestRun.regressions.filter((reg) => {
      if (filters.severity && reg.severity !== filters.severity) return false;
      if (filters.packageName && !matchesTextFilter(reg.affectedPackage, filters.packageName)) {
        return false;
      }
      return true;
    });
  }, [latestRun, filters.severity, filters.packageName]);

  const failedChecks = useMemo(
    () => filteredChecks.filter((check) => check.status === 'FAILED' || check.status === 'BLOCKED'),
    [filteredChecks]
  );

  const securityChecks = useMemo(
    () =>
      filteredChecks.filter(
        (check) => check.category === 'security' || check.scoringCategory === 'security'
      ),
    [filteredChecks]
  );

  const securityRegressions = useMemo(
    () => filteredRegressions.filter((reg) => reg.category === 'security'),
    [filteredRegressions]
  );

  const newRegressions = useMemo(
    () => filteredRegressions.filter((reg) => !reg.isPreExisting),
    [filteredRegressions]
  );

  const preExistingFailures = useMemo(
    () => filteredRegressions.filter((reg) => reg.isPreExisting),
    [filteredRegressions]
  );

  const performanceChecks = useMemo(
    () =>
      filteredChecks.filter(
        (check) =>
          check.category === 'performance' ||
          check.scoringCategory === 'performance' ||
          check.checkId.includes('build') ||
          check.checkId.includes('type-check')
      ),
    [filteredChecks]
  );

  const databaseChecks = useMemo(
    () =>
      filteredChecks.filter(
        (check) => check.category === 'database' || check.scoringCategory === 'database_integrity'
      ),
    [filteredChecks]
  );

  const integrationChecks = useMemo(
    () =>
      filteredChecks.filter(
        (check) => check.category === 'reliability' || check.category === 'infrastructure'
      ),
    [filteredChecks]
  );

  const orderedCategoryScores = useMemo(() => {
    if (!latestRun) return [];
    const byCategory = new Map(latestRun.score.categoryScores.map((item) => [item.category, item]));
    return ORDERED_SCORING_CATEGORIES.map((category) => {
      const existing = byCategory.get(category);
      if (existing) return existing;
      return {
        category,
        weight: SCORING_CATEGORY_META[category].weightPct / PERCENT_DIVISOR,
        score: 0,
        verified: 0,
        failed: 0,
        skipped: 0,
        unavailable: 0,
      };
    });
  }, [latestRun]);

  const updateFilter = (field: keyof QualityIntelligenceFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleDownloadJson = () => {
    if (!data) return;
    const shaPrefix = latestRun?.commitSha.slice(0, SHA_PREVIEW_LENGTH) ?? 'no-run';
    triggerFileDownload({
      filename: `quality-intelligence-${shaPrefix}.json`,
      content: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
    });
  };

  const handleDownloadMarkdown = () => {
    if (!data) return;
    const shaPrefix = latestRun?.commitSha.slice(0, SHA_PREVIEW_LENGTH) ?? 'no-run';
    triggerFileDownload({
      filename: `quality-intelligence-${shaPrefix}.md`,
      content: buildMarkdownReport(data),
      mimeType: 'text/markdown',
    });
  };

  return (
    <section aria-label="Quality Intelligence Console" className="space-y-6">
      {/* Interactive Filter Toolbar */}
      <GlassCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--accent-blue)]" />
            <h2 className="font-semibold text-[var(--text-heading)] text-sm">
              Verification Filters &amp; Evidence Scope
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset all quality filters"
              className={ACTION_BUTTON_CLASS}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => void query.refetch()}
              aria-label="Refresh quality intelligence telemetry"
              className={ACTION_BUTTON_CLASS}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <input
            type="text"
            value={filters.agent}
            onChange={(e) => updateFilter('agent', e.target.value)}
            placeholder="Agent ID or name"
            aria-label="Filter by agent"
            className={FILTER_INPUT_CLASS}
          />
          <input
            type="text"
            value={filters.department}
            onChange={(e) => updateFilter('department', e.target.value)}
            placeholder="Department"
            aria-label="Filter by department"
            className={FILTER_INPUT_CLASS}
          />
          <input
            type="text"
            value={filters.packageName}
            onChange={(e) => updateFilter('packageName', e.target.value)}
            placeholder="Package (e.g. @repo/contract)"
            aria-label="Filter by package"
            className={FILTER_INPUT_CLASS}
          />
          <input
            type="text"
            value={filters.branch}
            onChange={(e) => updateFilter('branch', e.target.value)}
            placeholder="Branch"
            aria-label="Filter by branch"
            className={FILTER_INPUT_CLASS}
          />
          <input
            type="text"
            value={filters.commit}
            onChange={(e) => updateFilter('commit', e.target.value)}
            placeholder="Commit SHA"
            aria-label="Filter by commit SHA"
            className={FILTER_INPUT_CLASS}
          />
          <input
            type="text"
            value={filters.pullRequest}
            onChange={(e) => updateFilter('pullRequest', e.target.value)}
            placeholder="Pull Request ID"
            aria-label="Filter by pull request"
            className={FILTER_INPUT_CLASS}
          />
          <select
            value={filters.severity}
            onChange={(e) => updateFilter('severity', e.target.value)}
            aria-label="Filter by severity"
            className={FILTER_INPUT_CLASS}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="INFO">INFO</option>
          </select>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => updateFilter('date', e.target.value)}
            aria-label="Filter by date"
            className={FILTER_INPUT_CLASS}
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            aria-label="Filter by verification status"
            className={FILTER_INPUT_CLASS}
          >
            <option value="">All Verification Statuses</option>
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>
      </GlassCard>

      {/* Loading / Error / Honest Empty States */}
      {query.isLoading && (
        <GlassCard className="p-6" role="status" aria-busy="true">
          <p className="text-[var(--text-secondary)] text-sm">
            Loading verification evidence and quality intelligence telemetry...
          </p>
        </GlassCard>
      )}

      {query.isError && (
        <GlassCard className="border-rose-200 bg-rose-50/70 p-5" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-rose-800 text-sm">
                Quality Intelligence Telemetry Unavailable
              </h2>
              <p className="text-rose-700 text-xs">
                {query.error instanceof Error
                  ? query.error.message
                  : 'Unable to reach /api/control-room/quality-intelligence.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void query.refetch()}
              aria-label="Retry loading quality intelligence"
              className={ACTION_BUTTON_CLASS}
            >
              Retry
            </button>
          </div>
        </GlassCard>
      )}

      {!query.isLoading && !query.isError && latestRun === null && (
        <GlassCard className="p-6" role="status">
          <h2 className={SECTION_HEADING_CLASS}>No Verification Run Evidence Available</h2>
          <p className="mt-1 text-[var(--text-secondary)] text-xs">
            No matching quality verification runs were returned for the active filters. Run{' '}
            <code className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5">pnpm quality:run</code>{' '}
            or clear active filters to inspect verified runs.
          </p>
          {unavailableReasons.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-[var(--text-secondary)] text-xs">
              {unavailableReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {/* Drill-Down Panel */}
      {drillDown && <DrillDownDrawer target={drillDown} onClose={() => setDrillDown(null)} />}

      {/* Sections 1, 3, 4: Overall Score, Verification & Block Status, Commit & Digest */}
      {latestRun && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Section 1: Overall System Quality Score */}
          <section aria-labelledby={`${baseId}-s1`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s1`}
                icon={<ShieldCheck className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="1. Overall System Quality Score"
                subtitle="Weighted deterministic gate score"
              />
              <p className="font-bold text-3xl text-[var(--text-heading)]">
                {latestRun.score.overallScore.toFixed(1)}%
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className={CARD_SURFACE_CLASS}>
                  <span className="text-[var(--text-secondary)]">Confidence</span>
                  <p className="mt-0.5 font-semibold text-[var(--text-heading)]">
                    {latestRun.score.confidencePct.toFixed(1)}%
                  </p>
                </div>
                <div className={CARD_SURFACE_CLASS}>
                  <span className="text-[var(--text-secondary)]">Coverage</span>
                  <p className="mt-0.5 font-semibold text-[var(--text-heading)]">
                    {latestRun.score.coveragePct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* Section 3: Current Verification Status & Mandatory-Gate Block Indicator */}
          <section aria-labelledby={`${baseId}-s3`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s3`}
                icon={<AlertOctagon className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="3. Verification &amp; Block Status"
                subtitle="Mandatory gate enforcement state"
                rightSlot={<StatusBadge status={latestRun.overallStatus} />}
              />
              <div className="space-y-2 text-xs">
                <div className={CARD_SURFACE_CLASS}>
                  <span className="text-[var(--text-secondary)]">Mandatory Gate Block</span>
                  <p className="mt-1 font-semibold text-[var(--text-heading)]">
                    {latestRun.score.releaseBlocked
                      ? 'BLOCKED — Mandatory Gate Failure'
                      : 'CLEAR — No Mandatory Gate Block'}
                  </p>
                </div>
                <div className={CARD_SURFACE_CLASS}>
                  <span className="text-[var(--text-secondary)]">Mandatory Failures</span>
                  <p className="mt-0.5 font-semibold text-[var(--text-heading)]">
                    {latestRun.score.mandatoryFailures}
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* Section 4: Latest Verified Commit SHA & Evidence SHA-256 Digest */}
          <section aria-labelledby={`${baseId}-s4`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s4`}
                icon={<GitCommit className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="4. Verified Commit &amp; Digest"
                subtitle="Immutable SHA-256 evidence chain"
              />
              <div className="space-y-2 text-xs">
                <div className={CARD_SURFACE_CLASS}>
                  <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                    <GitBranch className="h-3 w-3" /> Branch &amp; Commit SHA
                  </span>
                  <p className="mt-0.5 break-all font-mono font-semibold text-[var(--text-heading)]">
                    {latestRun.branch} · {latestRun.commitSha}
                  </p>
                </div>
                <div className={CARD_SURFACE_CLASS}>
                  <span className="text-[var(--text-secondary)]">Evidence SHA-256 Digest</span>
                  <p
                    title={latestRun.evidenceSha256}
                    className="mt-0.5 break-all font-mono text-[11px] text-[var(--text-heading)]"
                  >
                    {latestRun.evidenceSha256}
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>
        </div>
      )}

      {/* Section 2: 8-Category Quality Breakdown */}
      {latestRun && (
        <section aria-labelledby={`${baseId}-s2`}>
          <GlassCard className="p-5">
            <SectionTitle
              id={`${baseId}-s2`}
              icon={<Activity className="h-4 w-4 text-[var(--accent-blue)]" />}
              title="2. 8-Category Quality Breakdown"
              subtitle="Security 20%, Functional 20%, Architecture 15%, Reliability 15%, Performance 10%, Database 10%, A11y/UX 5%, Docs 5%"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {orderedCategoryScores.map((categoryScore) => (
                <CategoryScoreCard key={categoryScore.category} categoryScore={categoryScore} />
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* Sections 5 & 6: Agent Activity Summary & Agent Verification Reports */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Section 5: Agent Activity Summary */}
        <section aria-labelledby={`${baseId}-s5`}>
          <GlassCard className="h-full p-5">
            <SectionTitle
              id={`${baseId}-s5`}
              icon={<Bot className="h-4 w-4 text-[var(--accent-blue)]" />}
              title="5. Agent Activity Summary"
              subtitle="Speed vs correctness vs verification quality vs regression rate"
            />
            {agentMetrics.length === 0 ? (
              <EmptySectionNotice message="No agent activity metrics recorded for the current filter scope." />
            ) : (
              <div className="space-y-3">
                {agentMetrics.map((metric) => (
                  <div key={metric.agentId} className={CARD_SURFACE_CLASS}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-heading)] text-xs">
                        {metric.agentName} ({metric.agentId})
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {metric.tasksIndependentlyVerified}/{metric.tasksCompleted} verified ·
                        First-pass {metric.firstPassSuccessRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-[11px] text-[var(--text-secondary)]">Speed</span>
                        <p className="font-semibold text-[var(--text-heading)]">
                          {metric.speedScore.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Correctness
                        </span>
                        <p className="font-semibold text-[var(--text-heading)]">
                          {metric.correctnessScore.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Verification Quality
                        </span>
                        <p className="font-semibold text-[var(--text-heading)]">
                          {metric.verificationQualityScore.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Regression Rate
                        </span>
                        <p className="font-semibold text-[var(--text-heading)]">
                          {metric.regressionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </section>

        {/* Section 6: Agent Verification Reports */}
        <section aria-labelledby={`${baseId}-s6`}>
          <GlassCard className="h-full p-5">
            <SectionTitle
              id={`${baseId}-s6`}
              icon={<FileCode2 className="h-4 w-4 text-[var(--accent-blue)]" />}
              title="6. Agent Verification Reports"
              subtitle="Declared vs actual Git diff parity & 8-state verification status"
            />
            {agentReports.length === 0 ? (
              <EmptySectionNotice message="No agent verification reports submitted for the current filter scope." />
            ) : (
              <div className="space-y-3">
                {agentReports.map((report) => (
                  <div key={report.verificationId} className={CARD_SURFACE_CLASS}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--text-heading)] text-xs">
                          {report.agentReport.agentName} · Task {report.agentReport.taskId}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Declared: {report.agentReport.state} · Verified by {report.verifiedBy}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AgentStateBadge state={report.computedState} />
                        <span
                          className={cn(
                            BADGE_BASE_CLASS,
                            report.fileDiffMatches
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          )}
                        >
                          {report.fileDiffMatches ? 'Git Diff Matched' : 'Git Diff Mismatch'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--text-primary)]">
                      Actual files: {report.actualChangedFiles.length} · Undeclared:{' '}
                      {report.undeclaredFiles.length} · Missing declared:{' '}
                      {report.missingDeclaredFiles.length}
                    </p>
                    {report.findings.length > 0 && (
                      <p className="mt-1 text-[11px] text-rose-700">
                        Findings: {report.findings.join(' | ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </section>
      </div>

      {/* Sections 7, 8, 9: Failed Checks, Security Findings (+ securityRiskLevel), Regressions */}
      {latestRun && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Section 7: Failed Tests & Check Failures */}
          <section aria-labelledby={`${baseId}-s7`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s7`}
                icon={<XCircle className="h-4 w-4 text-rose-600" />}
                title="7. Failed Tests &amp; Check Failures"
                subtitle="Click any failure to inspect redacted logs"
              />
              {failedChecks.length === 0 ? (
                <EmptySectionNotice message="Zero failed or blocked checks in the current scope." />
              ) : (
                <div className="space-y-2">
                  {failedChecks.map((check) => (
                    <button
                      key={check.checkId}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'check', item: check })}
                      aria-label={`Inspect check failure ${check.name}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text-heading)] text-xs">
                          {check.name}
                        </span>
                        <StatusBadge status={check.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {check.command} · exit {check.exitCode ?? 'N/A'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>

          {/* Section 8: Security Findings & Separate securityRiskLevel */}
          <section aria-labelledby={`${baseId}-s8`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s8`}
                icon={<ShieldAlert className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="8. Security Findings"
                subtitle="Independent security risk posture"
                rightSlot={<SeverityBadge severity={latestRun.score.securityRiskLevel} />}
              />
              <div className={`${CARD_SURFACE_CLASS} mb-3`}>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Separate Security Risk Level
                </span>
                <p className="mt-0.5 font-semibold text-[var(--text-heading)] text-xs">
                  securityRiskLevel: {latestRun.score.securityRiskLevel}
                </p>
              </div>
              {securityChecks.length === 0 && securityRegressions.length === 0 ? (
                <EmptySectionNotice message="No security checks or findings recorded in the current scope." />
              ) : (
                <div className="space-y-2">
                  {securityChecks.map((check) => (
                    <button
                      key={check.checkId}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'check', item: check })}
                      aria-label={`Inspect security check ${check.name}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-heading)] text-xs">
                          {check.name}
                        </span>
                        <StatusBadge status={check.status} />
                      </div>
                    </button>
                  ))}
                  {securityRegressions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'regression', item: reg })}
                      aria-label={`Inspect security regression ${reg.id}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-heading)] text-xs">
                          {reg.id}
                        </span>
                        <SeverityBadge severity={reg.severity} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>

          {/* Section 9: Regression Alerts */}
          <section aria-labelledby={`${baseId}-s9`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s9`}
                icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                title="9. Regression Alerts"
                subtitle={`${newRegressions.length} new regressions · ${preExistingFailures.length} pre-existing`}
              />
              {filteredRegressions.length === 0 ? (
                <EmptySectionNotice message="Zero regressions or pre-existing baseline failures in scope." />
              ) : (
                <div className="space-y-2">
                  {filteredRegressions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'regression', item: reg })}
                      aria-label={`Inspect regression ${reg.id}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-[var(--text-heading)] text-xs">
                          {reg.id}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              BADGE_BASE_CLASS,
                              reg.isPreExisting
                                ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                            )}
                          >
                            {reg.isPreExisting ? 'Pre-existing Failure' : 'New Regression'}
                          </span>
                          <SeverityBadge severity={reg.severity} />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {reg.difference}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>
        </div>
      )}

      {/* Sections 10, 11, 12: Build & Performance Trends, Database Integrity, Integration Health */}
      {latestRun && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Section 10: Build & Performance Trends */}
          <section aria-labelledby={`${baseId}-s10`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s10`}
                icon={<TrendingUp className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="10. Build &amp; Performance Trends"
                subtitle="Gate durations and historical score trend"
              />
              {performanceChecks.length === 0 && runs.length === 0 ? (
                <EmptySectionNotice message="No build or performance telemetry available." />
              ) : (
                <div className="space-y-2 text-xs">
                  {performanceChecks.map((check) => (
                    <div key={check.checkId} className={CARD_SURFACE_CLASS}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-heading)]">{check.name}</span>
                        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                          {formatDuration(check.durationMs)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {runs.length > 0 && (
                    <div className={CARD_SURFACE_CLASS}>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Recent Run Score Trend
                      </span>
                      <p className="mt-1 font-mono text-[11px] text-[var(--text-heading)]">
                        {runs
                          .slice(0, MAX_RECENT_RUNS_TREND)
                          .map((r) => `${r.score.overallScore.toFixed(1)}%`)
                          .join(' <- ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          </section>

          {/* Section 11: Database Integrity & Migration Status */}
          <section aria-labelledby={`${baseId}-s11`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s11`}
                icon={<Database className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="11. Database Integrity &amp; Migrations"
                subtitle="PG17 migration lint, RLS InitPlan, contract parity"
              />
              {databaseChecks.length === 0 ? (
                <EmptySectionNotice message="No database integrity checks recorded in the current run." />
              ) : (
                <div className="space-y-2">
                  {databaseChecks.map((check) => (
                    <button
                      key={check.checkId}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'check', item: check })}
                      aria-label={`Inspect database check ${check.name}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-heading)] text-xs">
                          {check.name}
                        </span>
                        <StatusBadge status={check.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>

          {/* Section 12: Integration Health */}
          <section aria-labelledby={`${baseId}-s12`}>
            <GlassCard className="h-full p-5">
              <SectionTitle
                id={`${baseId}-s12`}
                icon={<Network className="h-4 w-4 text-[var(--accent-blue)]" />}
                title="12. Integration Health"
                subtitle="Reliability, runtime infrastructure &amp; service probes"
              />
              {integrationChecks.length === 0 ? (
                <EmptySectionNotice message="No integration health checks recorded in the current run." />
              ) : (
                <div className="space-y-2">
                  {integrationChecks.map((check) => (
                    <button
                      key={check.checkId}
                      type="button"
                      onClick={() => setDrillDown({ kind: 'check', item: check })}
                      aria-label={`Inspect integration check ${check.name}`}
                      className={DRILL_DOWN_ROW_CLASS}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-heading)] text-xs">
                          {check.name}
                        </span>
                        <StatusBadge status={check.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </section>
        </div>
      )}

      {/* Section 13: Release Readiness (10 Mandatory Requirements + Authorized Certify Button) */}
      <section aria-labelledby={`${baseId}-s13`}>
        <GlassCard className="p-5">
          <SectionTitle
            id={`${baseId}-s13`}
            icon={<Lock className="h-4 w-4 text-[var(--accent-blue)]" />}
            title="13. Release Readiness"
            subtitle="10 mandatory release certification requirements"
            rightSlot={
              releaseCertification ? (
                <ReleaseStatusBadge status={releaseCertification.status} />
              ) : undefined
            }
          />

          {!releaseCertification ? (
            <EmptySectionNotice
              message={
                latestRun
                  ? 'No release certification record has been created yet for this verification run.'
                  : 'Release certification evaluation is not available until a verification run is recorded.'
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {releaseCertification.requirements.map((req, index) => (
                  <div key={req.requirementId} className={CARD_SURFACE_CLASS}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
                        <div>
                          <p className="font-medium text-[var(--text-heading)] text-xs">
                            {index + 1}. {req.name}
                          </p>
                          {req.details && (
                            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                              {req.details}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                ))}
              </div>

              {releaseCertification.blockers.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs">
                  <p className="font-semibold">Release Blockers:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {releaseCertification.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(certifyFeedback || (canCertify && latestRun)) && (
            <div className="mt-4 space-y-4">
              {certifyFeedback && (
                <p
                  role="status"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-xs"
                >
                  {certifyFeedback}
                </p>
              )}

              {canCertify && latestRun && (
                <div className="flex flex-wrap items-center gap-3 border-[var(--border-subtle)] border-t pt-3">
                  <input
                    type="text"
                    value={certifyNotes}
                    onChange={(e) => setCertifyNotes(e.target.value)}
                    placeholder="Optional release certification notes"
                    aria-label="Release certification notes"
                    className={`${FILTER_INPUT_CLASS} max-w-md`}
                  />
                  <button
                    type="button"
                    disabled={certifyMutation.isPending}
                    onClick={() =>
                      certifyMutation.mutate({
                        commitSha: latestRun.commitSha,
                        evidenceSha256: latestRun.evidenceSha256,
                        notes: certifyNotes,
                      })
                    }
                    aria-label="Certify Release"
                    className={PRIMARY_BUTTON_CLASS}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {certifyMutation.isPending ? 'Certifying...' : 'Certify Release'}
                  </button>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </section>

      {/* Section 14: Historical Quality Reports + Downloadable JSON & Markdown Reports */}
      <section aria-labelledby={`${baseId}-s14`}>
        <GlassCard className="p-5">
          <SectionTitle
            id={`${baseId}-s14`}
            icon={<FileText className="h-4 w-4 text-[var(--accent-blue)]" />}
            title="14. Historical Quality Reports"
            subtitle="Append-only verification ledger & exportable audit manifests"
            rightSlot={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!data}
                  onClick={handleDownloadJson}
                  aria-label="Download JSON Report"
                  className={ACTION_BUTTON_CLASS}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  Download JSON
                </button>
                <button
                  type="button"
                  disabled={!data}
                  onClick={handleDownloadMarkdown}
                  aria-label="Download Markdown Report"
                  className={ACTION_BUTTON_CLASS}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Markdown
                </button>
              </div>
            }
          />

          {runs.length === 0 ? (
            <EmptySectionNotice message="No historical quality verification runs recorded yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
              <table className="w-full border-collapse text-left">
                <thead className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]">
                  <tr>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Commit &amp; Branch
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Status
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Score
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Security Risk
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Executed At
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Evidence Digest
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-primary)]">
                  {runs.map((run) => (
                    <tr key={run.runId}>
                      <td className={TABLE_CELL_CLASS}>
                        <span className="font-mono font-semibold text-[var(--text-heading)]">
                          {run.commitSha.slice(0, SHA_PREVIEW_LENGTH)}
                        </span>
                        <p className="text-[11px] text-[var(--text-secondary)]">{run.branch}</p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <StatusBadge status={run.overallStatus} />
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <span className="font-semibold text-[var(--text-heading)]">
                          {run.score.overallScore.toFixed(1)}%
                        </span>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <SeverityBadge severity={run.score.securityRiskLevel} />
                      </td>
                      <td className={TABLE_CELL_CLASS}>{formatTimestamp(run.executedAt)}</td>
                      <td className={TABLE_CELL_CLASS}>
                        <span title={run.evidenceSha256} className="font-mono text-[11px]">
                          {run.evidenceSha256.slice(0, DIGEST_PREVIEW_LENGTH)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>
    </section>
  );
}
