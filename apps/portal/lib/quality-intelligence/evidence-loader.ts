import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  type AgentPerformanceMetrics,
  type AgentVerificationReport,
  type AgentWorkReportRow,
  agentVerificationReportSchema,
  agentWorkReportRowSchema,
  type QualityReleaseCertificationRow,
  type QualityRunEvidence,
  type QualityVerificationRunRow,
  qualityReleaseCertificationRowSchema,
  qualityRunEvidenceSchema,
  qualityVerificationRunRowSchema,
  type ReleaseCertification,
  releaseCertificationSchema,
  type Severity,
  z,
} from '@repo/contract';
import { calculateAgentPerformance, redactSecrets } from '@repo/intelligence/quality';
import { logger } from '@repo/logger/server';
import type { createServerSupabaseClient } from '@repo/supabase/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const MAX_DB_ROWS = 100;
const UNDEFINED_TABLE_PG_CODE = '42P01';
const POSTGREST_MISSING_TABLE_CODE = 'PGRST205';

export type EvidenceSource = 'supabase' | 'local_artifacts' | 'none';

export interface QualityIntelligenceFilters {
  readonly agent?: string;
  readonly department?: string;
  readonly pkg?: string;
  readonly branch?: string;
  readonly commit?: string;
  readonly pr?: string;
  readonly severity?: Severity;
  readonly date?: string;
  readonly status?: string;
}

export interface AgentVerifyGateRecord {
  readonly id: number;
  readonly name: string;
  readonly command: string;
  readonly policy: string;
  readonly evidenceType?: string;
  readonly status: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputSha256: string;
}

export interface AgentVerifyEvidenceSummary {
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly gitTreeHash: string;
  readonly totalGates: number;
  readonly passedGates: number;
  readonly failedGates: number;
  readonly empiricalCoveragePct: number;
  readonly readinessClassification: string;
  readonly gates: readonly AgentVerifyGateRecord[];
}

export interface QualityIntelligenceSnapshot {
  readonly source: EvidenceSource;
  readonly loadedAt: string;
  readonly filters: QualityIntelligenceFilters;
  readonly latestRun: QualityRunEvidence | null;
  readonly runs: readonly QualityRunEvidence[];
  readonly agentReports: readonly AgentVerificationReport[];
  readonly agentPerformance: readonly AgentPerformanceMetrics[];
  readonly certifications: readonly ReleaseCertification[];
  readonly latestCertification: ReleaseCertification | null;
  readonly agentVerifyEvidence: AgentVerifyEvidenceSummary | null;
  readonly unavailableReasons: readonly string[];
}

export interface LoadQualityIntelligenceOptions {
  readonly supabase?: ServerSupabaseClient;
  readonly filters?: QualityIntelligenceFilters;
  readonly artifactsRootDir?: string;
}

interface RawEvidenceCollection {
  readonly runs: readonly QualityRunEvidence[];
  readonly agentReports: readonly AgentVerificationReport[];
  readonly certifications: readonly ReleaseCertification[];
  readonly certificationBranches: ReadonlyMap<string, string>;
  readonly agentVerifyEvidence: AgentVerifyEvidenceSummary | null;
}

const agentVerifyGateSchema = z.object({
  id: z.number(),
  name: z.string(),
  command: z.string(),
  policy: z.string(),
  evidenceType: z.string().optional(),
  status: z.string(),
  exitCode: z.number(),
  durationMs: z.number(),
  outputSha256: z.string(),
});

const agentVerifyEvidenceSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  gitTreeHash: z.string(),
  totalGates: z.number(),
  passedGates: z.number(),
  failedGates: z.number(),
  empiricalCoveragePct: z.number(),
  readinessClassification: z.string(),
  gates: z.array(agentVerifyGateSchema),
});

function redactDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return redactSecrets(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactDeep(entry)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      redactDeep(entryValue),
    ]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  if (error.code === UNDEFINED_TABLE_PG_CODE || error.code === POSTGREST_MISSING_TABLE_CODE) {
    return true;
  }
  const message = error.message ?? '';
  return (
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesSubstring(candidate: string | null | undefined, filterValue: string): boolean {
  return normalizeText(candidate).includes(normalizeText(filterValue));
}

function matchesCommitPrefix(candidate: string | null | undefined, filterValue: string): boolean {
  return normalizeText(candidate).startsWith(normalizeText(filterValue));
}

function matchesDatePrefix(isoTimestamp: string | null | undefined, dateFilter: string): boolean {
  return normalizeText(isoTimestamp).startsWith(normalizeText(dateFilter));
}

function runMatchesSearchToken(run: QualityRunEvidence, token: string): boolean {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return true;
  }
  const directFields = [run.repository, run.branch, run.taskId, run.agentId];
  if (directFields.some((field) => normalizeText(field).includes(normalizedToken))) {
    return true;
  }
  const checkMatched = run.checks.some(
    (check) =>
      normalizeText(check.owner).includes(normalizedToken) ||
      normalizeText(check.command).includes(normalizedToken) ||
      normalizeText(check.name).includes(normalizedToken) ||
      check.evidenceLinks.some((link) => normalizeText(link).includes(normalizedToken))
  );
  if (checkMatched) {
    return true;
  }
  return run.regressions.some(
    (regression) =>
      normalizeText(regression.affectedPackage).includes(normalizedToken) ||
      regression.affectedFiles.some((file) => normalizeText(file).includes(normalizedToken))
  );
}

function reportMatchesSearchToken(report: AgentVerificationReport, token: string): boolean {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return true;
  }
  const fields = [
    report.agentReport.taskId,
    report.agentReport.taskDescription,
    ...report.actualChangedFiles,
    ...report.agentReport.filesCreated,
    ...report.agentReport.filesModified,
    ...report.agentReport.filesDeleted,
    ...report.agentReport.dependenciesAdded,
    ...report.agentReport.dependenciesRemoved,
  ];
  if (fields.some((field) => normalizeText(field).includes(normalizedToken))) {
    return true;
  }
  return runMatchesSearchToken(report.runEvidence, token);
}

function matchesRunFilters(run: QualityRunEvidence, filters: QualityIntelligenceFilters): boolean {
  if (filters.agent && !matchesSubstring(run.agentId, filters.agent)) {
    return false;
  }
  if (filters.department && !runMatchesSearchToken(run, filters.department)) {
    return false;
  }
  if (filters.pkg && !runMatchesSearchToken(run, filters.pkg)) {
    return false;
  }
  if (filters.branch && !matchesSubstring(run.branch, filters.branch)) {
    return false;
  }
  if (filters.commit && !matchesCommitPrefix(run.commitSha, filters.commit)) {
    return false;
  }
  if (
    filters.pr &&
    normalizeText(run.pullRequestId?.replace(/^#/, '')) !==
      normalizeText(filters.pr.replace(/^#/, ''))
  ) {
    return false;
  }
  if (filters.severity) {
    const matchesSeverity =
      run.score.securityRiskLevel === filters.severity ||
      run.regressions.some((regression) => regression.severity === filters.severity);
    if (!matchesSeverity) {
      return false;
    }
  }
  if (filters.date && !matchesDatePrefix(run.executedAt, filters.date)) {
    return false;
  }
  if (filters.status && normalizeText(run.overallStatus) !== normalizeText(filters.status)) {
    return false;
  }
  return true;
}

function matchesReportFilters(
  report: AgentVerificationReport,
  filters: QualityIntelligenceFilters
): boolean {
  if (filters.agent) {
    const agentMatched =
      matchesSubstring(report.agentReport.agentId, filters.agent) ||
      matchesSubstring(report.agentReport.agentName, filters.agent) ||
      matchesSubstring(report.verifiedBy, filters.agent);
    if (!agentMatched) {
      return false;
    }
  }
  if (filters.department && !reportMatchesSearchToken(report, filters.department)) {
    return false;
  }
  if (filters.pkg && !reportMatchesSearchToken(report, filters.pkg)) {
    return false;
  }
  if (filters.branch && !matchesSubstring(report.runEvidence.branch, filters.branch)) {
    return false;
  }
  if (filters.commit) {
    const commitMatched =
      matchesCommitPrefix(report.agentReport.endingCommitSha, filters.commit) ||
      matchesCommitPrefix(report.agentReport.startingCommitSha, filters.commit) ||
      matchesCommitPrefix(report.runEvidence.commitSha, filters.commit);
    if (!commitMatched) {
      return false;
    }
  }
  if (
    filters.pr &&
    normalizeText(report.runEvidence.pullRequestId?.replace(/^#/, '')) !==
      normalizeText(filters.pr.replace(/^#/, ''))
  ) {
    return false;
  }
  if (filters.severity) {
    const matchesSeverity =
      report.runEvidence.score.securityRiskLevel === filters.severity ||
      report.runEvidence.regressions.some((regression) => regression.severity === filters.severity);
    if (!matchesSeverity) {
      return false;
    }
  }
  if (filters.date && !matchesDatePrefix(report.verifiedAt, filters.date)) {
    return false;
  }
  if (filters.status) {
    const statusNorm = normalizeText(filters.status);
    const matched =
      normalizeText(report.computedState) === statusNorm ||
      normalizeText(report.agentReport.state) === statusNorm ||
      normalizeText(report.runEvidence.overallStatus) === statusNorm;
    if (!matched) {
      return false;
    }
  }
  return true;
}

function matchesCertificationFilters(options: {
  readonly certification: ReleaseCertification;
  readonly filters: QualityIntelligenceFilters;
  readonly runsById: ReadonlyMap<string, QualityRunEvidence>;
  readonly certificationBranches: ReadonlyMap<string, string>;
}): boolean {
  const { certification, filters, runsById, certificationBranches } = options;
  const linkedRun = runsById.get(certification.evidenceRunId);

  if (
    filters.agent &&
    !matchesSubstring(certification.approvedBy, filters.agent) &&
    !matchesSubstring(linkedRun?.agentId, filters.agent)
  ) {
    return false;
  }
  if (filters.department && (!linkedRun || !runMatchesSearchToken(linkedRun, filters.department))) {
    return false;
  }
  if (filters.pkg && (!linkedRun || !runMatchesSearchToken(linkedRun, filters.pkg))) {
    return false;
  }
  if (filters.branch) {
    const certBranch =
      linkedRun?.branch ?? certificationBranches.get(certification.commitSha) ?? null;
    if (!matchesSubstring(certBranch, filters.branch)) {
      return false;
    }
  }
  if (filters.commit && !matchesCommitPrefix(certification.commitSha, filters.commit)) {
    return false;
  }
  if (
    filters.pr &&
    normalizeText(linkedRun?.pullRequestId?.replace(/^#/, '')) !==
      normalizeText(filters.pr.replace(/^#/, ''))
  ) {
    return false;
  }
  if (filters.severity) {
    const matchesSeverity =
      linkedRun?.score.securityRiskLevel === filters.severity ||
      linkedRun?.regressions.some((regression) => regression.severity === filters.severity) ||
      (filters.severity === 'CRITICAL' && certification.status === 'BLOCKED');
    if (!matchesSeverity) {
      return false;
    }
  }
  if (filters.date && !matchesDatePrefix(certification.certifiedAt, filters.date)) {
    return false;
  }
  if (filters.status && normalizeText(certification.status) !== normalizeText(filters.status)) {
    return false;
  }
  return true;
}

function mapRunRowToEvidence(row: QualityVerificationRunRow): QualityRunEvidence | null {
  const parsed = qualityRunEvidenceSchema.safeParse({
    runId: row.run_id,
    repository: row.repository,
    branch: row.branch,
    commitSha: row.commit_sha,
    parentCommitSha: row.parent_commit_sha,
    pullRequestId: row.pull_request_id,
    agentId: row.agent_id,
    taskId: row.task_id,
    executedAt: row.executed_at,
    environment: row.environment,
    mode: row.mode,
    overallStatus: row.overall_status,
    checks: row.checks,
    regressions: row.regressions,
    score: row.score_breakdown,
    evidenceSha256: row.evidence_sha256,
  });
  return parsed.success ? redactDeep(parsed.data) : null;
}

function mapWorkReportRow(
  row: AgentWorkReportRow,
  runsById: ReadonlyMap<string, QualityRunEvidence>
): AgentVerificationReport | null {
  if (!row.evidence_run_id) {
    return null;
  }
  const runEvidence = runsById.get(row.evidence_run_id);
  if (!runEvidence) {
    return null;
  }
  const parsed = agentVerificationReportSchema.safeParse({
    verificationId: row.verification_id,
    agentReport: row.agent_report,
    actualChangedFiles: row.actual_changed_files,
    undeclaredFiles: row.undeclared_files,
    missingDeclaredFiles: row.missing_declared_files,
    fileDiffMatches: row.file_diff_matches,
    computedState: row.computed_state,
    runEvidence,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    findings: row.findings,
  });
  return parsed.success ? redactDeep(parsed.data) : null;
}

function mapCertificationRow(row: QualityReleaseCertificationRow): ReleaseCertification | null {
  const parsed = releaseCertificationSchema.safeParse({
    commitSha: row.commit_sha,
    status: row.release_status,
    requirements: row.requirements,
    overallScore: Number(row.overall_score),
    blockers: row.blockers,
    evidenceRunId: row.evidence_run_id,
    certifiedAt: row.certified_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    notes: row.notes,
  });
  return parsed.success ? redactDeep(parsed.data) : null;
}

async function querySupabaseQualityTables(supabase: ServerSupabaseClient): Promise<{
  readonly collection: RawEvidenceCollection | null;
  readonly unavailableReasons: readonly string[];
}> {
  const unavailableReasons: string[] = [];

  const [runsResult, reportsResult, certsResult] = await Promise.all([
    supabase
      .from('quality_verification_runs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(MAX_DB_ROWS),
    supabase
      .from('agent_work_reports')
      .select('*')
      .order('verified_at', { ascending: false })
      .limit(MAX_DB_ROWS),
    supabase
      .from('quality_release_certifications')
      .select('*')
      .order('certified_at', { ascending: false })
      .limit(MAX_DB_ROWS),
  ]);

  const tableErrors = [
    { table: 'quality_verification_runs', error: runsResult.error },
    { table: 'agent_work_reports', error: reportsResult.error },
    { table: 'quality_release_certifications', error: certsResult.error },
  ].filter((entry) => entry.error !== null);

  if (tableErrors.length === 3 && tableErrors.every((entry) => isMissingTableError(entry.error))) {
    unavailableReasons.push('Quality intelligence database tables are not migrated yet (42P01).');
    return { collection: null, unavailableReasons };
  }

  for (const entry of tableErrors) {
    if (isMissingTableError(entry.error)) {
      unavailableReasons.push(`Database table ${entry.table} is not migrated yet.`);
    } else if (entry.error) {
      logger.warn(
        {
          event: 'quality_intelligence_db_query_error',
          table: entry.table,
          code: entry.error.code,
        },
        `Quality intelligence DB query failed for ${entry.table}`
      );
      unavailableReasons.push(
        `Database query failed for ${entry.table}: ${entry.error.message ?? 'unknown error'}`
      );
    }
  }

  const runs: QualityRunEvidence[] = [];
  for (const rawRow of Array.isArray(runsResult.data) ? runsResult.data : []) {
    const parsedRow = qualityVerificationRunRowSchema.safeParse({
      ...rawRow,
      overall_score: Number(rawRow.overall_score),
      confidence_pct: Number(rawRow.confidence_pct),
      coverage_pct: Number(rawRow.coverage_pct),
      mandatory_failures: Number(rawRow.mandatory_failures),
    });
    if (parsedRow.success) {
      const mapped = mapRunRowToEvidence(parsedRow.data);
      if (mapped) {
        runs.push(mapped);
      }
    }
  }

  const runsById = new Map(runs.map((run) => [run.runId, run]));

  const agentReports: AgentVerificationReport[] = [];
  for (const rawRow of Array.isArray(reportsResult.data) ? reportsResult.data : []) {
    const parsedRow = agentWorkReportRowSchema.safeParse(rawRow);
    if (parsedRow.success) {
      const mapped = mapWorkReportRow(parsedRow.data, runsById);
      if (mapped) {
        agentReports.push(mapped);
      }
    }
  }

  const certifications: ReleaseCertification[] = [];
  const certificationBranches = new Map<string, string>();
  for (const rawRow of Array.isArray(certsResult.data) ? certsResult.data : []) {
    const parsedRow = qualityReleaseCertificationRowSchema.safeParse({
      ...rawRow,
      overall_score: Number(rawRow.overall_score),
    });
    if (parsedRow.success) {
      certificationBranches.set(parsedRow.data.commit_sha, parsedRow.data.branch);
      const mapped = mapCertificationRow(parsedRow.data);
      if (mapped) {
        certifications.push(mapped);
      }
    }
  }

  if (runs.length === 0 && agentReports.length === 0 && certifications.length === 0) {
    if (unavailableReasons.length === 0) {
      unavailableReasons.push('No quality intelligence rows recorded in Supabase yet.');
    }
    return { collection: null, unavailableReasons };
  }

  return {
    collection: {
      runs,
      agentReports,
      certifications,
      certificationBranches,
      agentVerifyEvidence: null,
    },
    unavailableReasons,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveArtifactsRootDir(explicitRoot?: string): Promise<string> {
  if (explicitRoot) {
    return explicitRoot;
  }
  const candidates = [
    path.resolve(process.cwd(), '.ci-local'),
    path.resolve(process.cwd(), '..', '..', '.ci-local'),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return candidates[0] ?? path.resolve(process.cwd(), '.ci-local');
}

async function readJsonFileIfExists(filePath: string): Promise<unknown | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

async function readJsonDirectoryFiles(dirPath: string): Promise<unknown[]> {
  try {
    const entries = await readdir(dirPath);
    const jsonFiles = entries.filter((name) => name.endsWith('.json')).sort();
    const loaded = await Promise.all(
      jsonFiles.map((fileName) => readJsonFileIfExists(path.join(dirPath, fileName)))
    );
    return loaded.filter((entry) => entry !== null);
  } catch {
    return [];
  }
}

async function loadLocalArtifacts(
  explicitRoot?: string
): Promise<{ readonly collection: RawEvidenceCollection | null; readonly reason: string | null }> {
  const ciLocalDir = await resolveArtifactsRootDir(explicitRoot);
  const qualityDir = path.join(ciLocalDir, 'quality-intelligence');

  const [latestRaw, runFilesRaw, agentFilesRaw, releaseCertRaw, agentVerifyRaw] = await Promise.all(
    [
      readJsonFileIfExists(path.join(qualityDir, 'latest.json')),
      readJsonDirectoryFiles(path.join(qualityDir, 'runs')),
      readJsonDirectoryFiles(path.join(qualityDir, 'agent-verifications')),
      readJsonFileIfExists(path.join(qualityDir, 'release-certificate.json')),
      readJsonFileIfExists(path.join(ciLocalDir, 'agent-verify-evidence.json')),
    ]
  );

  const runsMap = new Map<string, QualityRunEvidence>();
  const runCandidates = [...runFilesRaw, ...(latestRaw ? [latestRaw] : [])];
  for (const candidate of runCandidates) {
    const parsed = qualityRunEvidenceSchema.safeParse(candidate);
    if (parsed.success) {
      const sanitized = redactDeep(parsed.data);
      runsMap.set(sanitized.runId, sanitized);
    }
  }
  const runs = [...runsMap.values()].sort((a, b) => b.executedAt.localeCompare(a.executedAt));

  const reportsMap = new Map<string, AgentVerificationReport>();
  for (const candidate of agentFilesRaw) {
    const parsed = agentVerificationReportSchema.safeParse(candidate);
    if (parsed.success) {
      const sanitized = redactDeep(parsed.data);
      reportsMap.set(sanitized.verificationId, sanitized);
    }
  }
  const agentReports = [...reportsMap.values()].sort((a, b) =>
    b.verifiedAt.localeCompare(a.verifiedAt)
  );

  const certifications: ReleaseCertification[] = [];
  if (releaseCertRaw) {
    const parsed = releaseCertificationSchema.safeParse(releaseCertRaw);
    if (parsed.success) {
      certifications.push(redactDeep(parsed.data));
    }
  }

  let agentVerifyEvidence: AgentVerifyEvidenceSummary | null = null;
  if (agentVerifyRaw) {
    const parsed = agentVerifyEvidenceSchema.safeParse(agentVerifyRaw);
    if (parsed.success) {
      agentVerifyEvidence = redactDeep(parsed.data);
    }
  }

  const hasAnyArtifact =
    runs.length > 0 ||
    agentReports.length > 0 ||
    certifications.length > 0 ||
    agentVerifyEvidence !== null;

  if (!hasAnyArtifact) {
    return {
      collection: null,
      reason: 'No local verified quality intelligence artifacts found on disk.',
    };
  }

  return {
    collection: {
      runs,
      agentReports,
      certifications,
      certificationBranches: new Map(),
      agentVerifyEvidence,
    },
    reason: null,
  };
}

function buildAgentPerformance(
  agentReports: readonly AgentVerificationReport[]
): AgentPerformanceMetrics[] {
  if (agentReports.length === 0) {
    return [];
  }
  const grouped = new Map<
    string,
    { readonly agentName: string; readonly verifications: AgentVerificationReport[] }
  >();
  for (const report of agentReports) {
    const { agentId, agentName } = report.agentReport;
    const existing = grouped.get(agentId);
    if (existing) {
      existing.verifications.push(report);
    } else {
      grouped.set(agentId, { agentName, verifications: [report] });
    }
  }

  return [...grouped.entries()].map(([agentId, group]) =>
    calculateAgentPerformance({
      agentId,
      agentName: group.agentName,
      verifications: group.verifications,
    })
  );
}

function applyFiltersToCollection(options: {
  readonly collection: RawEvidenceCollection;
  readonly filters: QualityIntelligenceFilters;
  readonly source: EvidenceSource;
  readonly unavailableReasons: readonly string[];
}): QualityIntelligenceSnapshot {
  const { collection, filters, source, unavailableReasons } = options;
  const runsById = new Map(collection.runs.map((run) => [run.runId, run]));

  const filteredRuns = collection.runs.filter((run) => matchesRunFilters(run, filters));
  const filteredReports = collection.agentReports.filter((report) =>
    matchesReportFilters(report, filters)
  );
  const filteredCertifications = collection.certifications.filter((certification) =>
    matchesCertificationFilters({
      certification,
      filters,
      runsById,
      certificationBranches: collection.certificationBranches,
    })
  );

  return {
    source,
    loadedAt: new Date().toISOString(),
    filters,
    latestRun: filteredRuns[0] ?? null,
    runs: filteredRuns,
    agentReports: filteredReports,
    agentPerformance: buildAgentPerformance(filteredReports),
    certifications: filteredCertifications,
    latestCertification: filteredCertifications[0] ?? null,
    agentVerifyEvidence: collection.agentVerifyEvidence,
    unavailableReasons,
  };
}

/**
 * Loads verified Quality Intelligence evidence from Supabase when available,
 * falling back to read-only local `.ci-local` verification artifacts, or an
 * honest empty payload when neither source contains verified data.
 */
export async function loadQualityIntelligenceSnapshot(
  options: LoadQualityIntelligenceOptions = {}
): Promise<QualityIntelligenceSnapshot> {
  const filters = options.filters ?? {};
  const unavailableReasons: string[] = [];

  if (options.supabase) {
    const dbResult = await querySupabaseQualityTables(options.supabase);
    unavailableReasons.push(...dbResult.unavailableReasons);
    if (dbResult.collection) {
      return applyFiltersToCollection({
        collection: dbResult.collection,
        filters,
        source: 'supabase',
        unavailableReasons,
      });
    }
  }

  const localResult = await loadLocalArtifacts(options.artifactsRootDir);
  if (localResult.reason) {
    unavailableReasons.push(localResult.reason);
  }
  if (localResult.collection) {
    return applyFiltersToCollection({
      collection: localResult.collection,
      filters,
      source: 'local_artifacts',
      unavailableReasons,
    });
  }

  return {
    source: 'none',
    loadedAt: new Date().toISOString(),
    filters,
    latestRun: null,
    runs: [],
    agentReports: [],
    agentPerformance: [],
    certifications: [],
    latestCertification: null,
    agentVerifyEvidence: null,
    unavailableReasons,
  };
}
