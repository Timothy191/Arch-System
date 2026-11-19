import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

// ---------------------------------------------------------------------------
// Shared Primitives
// ---------------------------------------------------------------------------

const GIT_SHA_REGEX = /^[0-9a-f]{7,40}$/i;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

export const gitShaSchema = z
  .string()
  .trim()
  .regex(GIT_SHA_REGEX, 'Must be a valid Git commit SHA (7-40 hex characters)');
export type GitSha = z.infer<typeof gitShaSchema>;

export const sha256HexSchema = z
  .string()
  .trim()
  .regex(SHA256_HEX_REGEX, 'Must be a valid 64-character SHA-256 hex digest');
export type Sha256Hex = z.infer<typeof sha256HexSchema>;

// ---------------------------------------------------------------------------
// Core Enumerations
// ---------------------------------------------------------------------------

export const agentCompletionStateSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'IMPLEMENTATION_COMPLETE',
  'VERIFICATION_PENDING',
  'VERIFICATION_PASSED',
  'VERIFICATION_FAILED',
  'BLOCKED',
  'REQUIRES_HUMAN_APPROVAL',
]);
export type AgentCompletionState = z.infer<typeof agentCompletionStateSchema>;

export const checkStatusSchema = z.enum(['PASSED', 'FAILED', 'SKIPPED', 'UNAVAILABLE', 'BLOCKED']);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const gateCategorySchema = z.enum([
  'code_quality',
  'architecture',
  'testing',
  'security',
  'database',
  'performance',
  'ui_ux',
  'infrastructure',
  'reliability',
  'agent_governance',
]);
export type GateCategory = z.infer<typeof gateCategorySchema>;

export const scoringCategorySchema = z.enum([
  'security',
  'functional_testing',
  'architecture',
  'reliability',
  'performance',
  'database_integrity',
  'accessibility_ux',
  'documentation_governance',
]);
export type ScoringCategory = z.infer<typeof scoringCategorySchema>;

export const releaseStatusSchema = z.enum([
  'NOT_READY',
  'READY_FOR_REVIEW',
  'APPROVED',
  'BLOCKED',
  'RELEASED',
  'ROLLBACK_REQUIRED',
]);
export type ReleaseStatus = z.infer<typeof releaseStatusSchema>;

export const severitySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export type Severity = z.infer<typeof severitySchema>;

// ---------------------------------------------------------------------------
// Agent Completion Report
// ---------------------------------------------------------------------------

export const commandExecutionResultSchema = z.object({
  command: nonEmptyString.max(1000),
  exitCode: z.number().int(),
  durationMs: z.number().nonnegative().optional(),
  status: checkStatusSchema.optional(),
  summary: z.string().max(2000).optional(),
});
export type CommandExecutionResult = z.infer<typeof commandExecutionResultSchema>;

export const agentCompletionReportSchema = z.object({
  agentId: nonEmptyString.max(128),
  agentName: nonEmptyString.max(128),
  taskId: nonEmptyString.max(128),
  taskDescription: nonEmptyString.max(4000),
  startingCommitSha: gitShaSchema,
  endingCommitSha: gitShaSchema,
  filesCreated: z.array(nonEmptyString.max(512)),
  filesModified: z.array(nonEmptyString.max(512)),
  filesDeleted: z.array(nonEmptyString.max(512)),
  dependenciesAdded: z.array(nonEmptyString.max(256)),
  dependenciesRemoved: z.array(nonEmptyString.max(256)),
  featuresImplemented: z.array(nonEmptyString.max(1000)),
  testsCreated: z.array(nonEmptyString.max(512)),
  testsExecuted: z.array(nonEmptyString.max(512)),
  commandsExecuted: z.array(nonEmptyString.max(1000)),
  commandResults: z.array(commandExecutionResultSchema),
  knownDefects: z.array(nonEmptyString.max(1000)),
  unresolvedIssues: z.array(nonEmptyString.max(1000)),
  securityImpact: z.string().max(2000),
  databaseImpact: z.string().max(2000),
  integrationImpact: z.string().max(2000),
  performanceImpact: z.string().max(2000),
  documentationUpdates: z.array(nonEmptyString.max(512)),
  evidenceReferences: z.array(nonEmptyString.max(1000)),
  state: agentCompletionStateSchema,
  submittedAt: z.string().datetime({ offset: true }),
});
export type AgentCompletionReport = z.infer<typeof agentCompletionReportSchema>;

// ---------------------------------------------------------------------------
// Quality Checks, Regressions & Scoring
// ---------------------------------------------------------------------------

export const qualityCheckResultSchema = z.object({
  checkId: nonEmptyString.max(128),
  name: nonEmptyString.max(256),
  category: gateCategorySchema,
  scoringCategory: scoringCategorySchema,
  owner: nonEmptyString.max(128),
  command: nonEmptyString.max(1000),
  mandatory: z.boolean(),
  status: checkStatusSchema,
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  skipReason: z.string().max(1000).nullable().optional(),
  logExcerpt: z.string().max(8000).nullable().optional(),
  evidenceLinks: z.array(nonEmptyString.max(1000)),
});
export type QualityCheckResult = z.infer<typeof qualityCheckResultSchema>;

export const regressionFindingSchema = z.object({
  id: nonEmptyString.max(128),
  severity: severitySchema,
  category: gateCategorySchema,
  affectedPackage: nonEmptyString.max(256),
  affectedFiles: z.array(nonEmptyString.max(512)),
  previousResult: z.string().max(2000),
  currentResult: z.string().max(2000),
  difference: z.string().max(4000),
  suggestedRemediation: z.string().max(4000),
  evidence: z.array(nonEmptyString.max(1000)),
  isPreExisting: z.boolean(),
});
export type RegressionFinding = z.infer<typeof regressionFindingSchema>;

export const categoryScoreSchema = z.object({
  category: scoringCategorySchema,
  weight: z.number().min(0).max(1),
  score: z.number().min(0).max(100),
  verified: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
});
export type CategoryScore = z.infer<typeof categoryScoreSchema>;

export const qualityScoreBreakdownSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categoryScores: z.array(categoryScoreSchema).min(1),
  confidencePct: z.number().min(0).max(100),
  coveragePct: z.number().min(0).max(100),
  securityRiskLevel: severitySchema,
  mandatoryFailures: z.number().int().nonnegative(),
  releaseBlocked: z.boolean(),
});
export type QualityScoreBreakdown = z.infer<typeof qualityScoreBreakdownSchema>;

// ---------------------------------------------------------------------------
// Verification Evidence & Agent Verification Reports
// ---------------------------------------------------------------------------

export const qualityRunEvidenceSchema = z.object({
  runId: uuidSchema,
  repository: nonEmptyString.max(256),
  branch: nonEmptyString.max(256),
  commitSha: gitShaSchema,
  parentCommitSha: gitShaSchema.nullable().optional(),
  pullRequestId: nonEmptyString.max(64).nullable().optional(),
  agentId: nonEmptyString.max(128).nullable().optional(),
  taskId: nonEmptyString.max(128).nullable().optional(),
  executedAt: z.string().datetime({ offset: true }),
  environment: nonEmptyString.max(64),
  mode: nonEmptyString.max(64),
  overallStatus: checkStatusSchema,
  checks: z.array(qualityCheckResultSchema),
  regressions: z.array(regressionFindingSchema),
  score: qualityScoreBreakdownSchema,
  evidenceSha256: sha256HexSchema,
});
export type QualityRunEvidence = z.infer<typeof qualityRunEvidenceSchema>;

export const agentVerificationReportSchema = z.object({
  verificationId: uuidSchema,
  agentReport: agentCompletionReportSchema,
  actualChangedFiles: z.array(nonEmptyString.max(512)),
  undeclaredFiles: z.array(nonEmptyString.max(512)),
  missingDeclaredFiles: z.array(nonEmptyString.max(512)),
  fileDiffMatches: z.boolean(),
  computedState: agentCompletionStateSchema,
  runEvidence: qualityRunEvidenceSchema,
  verifiedBy: nonEmptyString.max(128),
  verifiedAt: z.string().datetime({ offset: true }),
  findings: z.array(nonEmptyString.max(2000)),
});
export type AgentVerificationReport = z.infer<typeof agentVerificationReportSchema>;

export const agentPerformanceMetricsSchema = z.object({
  agentId: nonEmptyString.max(128),
  agentName: nonEmptyString.max(128),
  tasksCompleted: z.number().int().nonnegative(),
  tasksIndependentlyVerified: z.number().int().nonnegative(),
  firstPassVerificationSuccessCount: z.number().int().nonnegative(),
  firstPassSuccessRate: z.number().min(0).max(100),
  defectsIntroduced: z.number().int().nonnegative(),
  regressionsIntroduced: z.number().int().nonnegative(),
  reopenedTasks: z.number().int().nonnegative(),
  testCoverageContribution: z.number().min(0).max(100),
  securityFindingsIntroduced: z.number().int().nonnegative(),
  avgVerificationDurationMs: z.number().nonnegative(),
  unresolvedBlockers: z.number().int().nonnegative(),
  documentationCompletenessPct: z.number().min(0).max(100),
  evidenceCompletenessPct: z.number().min(0).max(100),
  speedScore: z.number().min(0).max(100),
  correctnessScore: z.number().min(0).max(100),
  verificationQualityScore: z.number().min(0).max(100),
  regressionRate: z.number().min(0).max(100),
});
export type AgentPerformanceMetrics = z.infer<typeof agentPerformanceMetricsSchema>;

// ---------------------------------------------------------------------------
// Release Certification
// ---------------------------------------------------------------------------

export const releaseRequirementResultSchema = z.object({
  requirementId: nonEmptyString.max(128),
  name: nonEmptyString.max(256),
  category: gateCategorySchema,
  mandatory: z.boolean(),
  status: checkStatusSchema,
  details: z.string().max(2000).optional(),
  evidenceRef: z.string().max(1000).optional(),
});
export type ReleaseRequirementResult = z.infer<typeof releaseRequirementResultSchema>;

export const releaseCertificationSchema = z.object({
  commitSha: gitShaSchema,
  status: releaseStatusSchema,
  requirements: z.array(releaseRequirementResultSchema).min(1),
  overallScore: z.number().min(0).max(100),
  blockers: z.array(nonEmptyString.max(1000)),
  evidenceRunId: uuidSchema,
  certifiedAt: z.string().datetime({ offset: true }),
  approvedBy: nonEmptyString.max(128).nullable().optional(),
  approvedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export type ReleaseCertification = z.infer<typeof releaseCertificationSchema>;

// ---------------------------------------------------------------------------
// Database Table Row Schemas (snake_case SSoT matching migration 226)
// ---------------------------------------------------------------------------

export const qualityVerificationRunRowSchema = z.object({
  id: uuidSchema,
  run_id: uuidSchema,
  repository: nonEmptyString.max(256),
  branch: nonEmptyString.max(256),
  commit_sha: gitShaSchema,
  parent_commit_sha: gitShaSchema.nullable(),
  pull_request_id: nonEmptyString.max(64).nullable(),
  agent_id: nonEmptyString.max(128).nullable(),
  task_id: nonEmptyString.max(128).nullable(),
  executed_at: z.string().datetime({ offset: true }),
  environment: nonEmptyString.max(64),
  mode: nonEmptyString.max(64),
  overall_status: checkStatusSchema,
  overall_score: z.number().min(0).max(100),
  confidence_pct: z.number().min(0).max(100),
  coverage_pct: z.number().min(0).max(100),
  security_risk_level: severitySchema,
  mandatory_failures: z.number().int().nonnegative(),
  release_blocked: z.boolean(),
  checks: z.array(qualityCheckResultSchema),
  regressions: z.array(regressionFindingSchema),
  score_breakdown: qualityScoreBreakdownSchema,
  evidence_sha256: sha256HexSchema,
  created_by: uuidSchema.nullable(),
  created_at: z.string().datetime({ offset: true }),
});
export type QualityVerificationRunRow = z.infer<typeof qualityVerificationRunRowSchema>;

export const agentWorkReportRowSchema = z.object({
  id: uuidSchema,
  verification_id: uuidSchema,
  agent_id: nonEmptyString.max(128),
  agent_name: nonEmptyString.max(128),
  task_id: nonEmptyString.max(128),
  task_description: nonEmptyString.max(4000),
  starting_commit_sha: gitShaSchema,
  ending_commit_sha: gitShaSchema,
  declared_state: agentCompletionStateSchema,
  computed_state: agentCompletionStateSchema,
  file_diff_matches: z.boolean(),
  actual_changed_files: z.array(nonEmptyString.max(512)),
  undeclared_files: z.array(nonEmptyString.max(512)),
  missing_declared_files: z.array(nonEmptyString.max(512)),
  agent_report: agentCompletionReportSchema,
  findings: z.array(nonEmptyString.max(2000)),
  evidence_run_id: uuidSchema.nullable(),
  verified_by: nonEmptyString.max(128),
  verified_at: z.string().datetime({ offset: true }),
  submitted_at: z.string().datetime({ offset: true }),
  created_by: uuidSchema.nullable(),
  created_at: z.string().datetime({ offset: true }),
});
export type AgentWorkReportRow = z.infer<typeof agentWorkReportRowSchema>;

export const qualityReleaseCertificationRowSchema = z.object({
  id: uuidSchema,
  commit_sha: gitShaSchema,
  branch: nonEmptyString.max(256),
  release_status: releaseStatusSchema,
  overall_score: z.number().min(0).max(100),
  requirements: z.array(releaseRequirementResultSchema),
  blockers: z.array(nonEmptyString.max(1000)),
  evidence_run_id: uuidSchema,
  certified_at: z.string().datetime({ offset: true }),
  approved_by: uuidSchema.nullable(),
  approved_at: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().max(4000).nullable(),
  created_by: uuidSchema.nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type QualityReleaseCertificationRow = z.infer<typeof qualityReleaseCertificationRowSchema>;
