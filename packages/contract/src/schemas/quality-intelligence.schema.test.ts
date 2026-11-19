import {
  agentCompletionReportSchema,
  agentCompletionStateSchema,
  agentPerformanceMetricsSchema,
  agentVerificationReportSchema,
  agentWorkReportRowSchema,
  categoryScoreSchema,
  checkStatusSchema,
  gateCategorySchema,
  qualityCheckResultSchema,
  qualityReleaseCertificationRowSchema,
  qualityRunEvidenceSchema,
  qualityScoreBreakdownSchema,
  qualityVerificationRunRowSchema,
  regressionFindingSchema,
  releaseCertificationSchema,
  releaseRequirementResultSchema,
  releaseStatusSchema,
  scoringCategorySchema,
  severitySchema,
} from './quality-intelligence.schema';

const SAMPLE_UUID = '123e4567-e89b-12d3-a456-426614174000';
const SAMPLE_RUN_UUID = '223e4567-e89b-12d3-a456-426614174001';
const SAMPLE_VERIFICATION_UUID = '323e4567-e89b-12d3-a456-426614174002';
const SAMPLE_COMMIT_START = 'abc1234def5678';
const SAMPLE_COMMIT_END = 'fed9876cba4321';
const SAMPLE_SHA256 = 'a'.repeat(64);
const SAMPLE_TIMESTAMP = '2026-11-19T14:30:00.000Z';

function buildAgentCompletionReport() {
  return {
    agentId: 'worker-1b',
    agentName: 'Contracts & Migration Engineer',
    taskId: 'TASK-QIE-01B',
    taskDescription: 'Define quality intelligence contracts and migration 226',
    startingCommitSha: SAMPLE_COMMIT_START,
    endingCommitSha: SAMPLE_COMMIT_END,
    filesCreated: ['packages/contract/src/schemas/quality-intelligence.schema.ts'],
    filesModified: ['packages/contract/src/index.ts'],
    filesDeleted: [],
    dependenciesAdded: [],
    dependenciesRemoved: [],
    featuresImplemented: ['Quality intelligence Zod schemas', 'Migration 226'],
    testsCreated: ['packages/contract/src/schemas/quality-intelligence.schema.test.ts'],
    testsExecuted: ['pnpm --filter @repo/contract test'],
    commandsExecuted: ['pnpm --filter @repo/contract build', 'pnpm --filter @repo/contract test'],
    commandResults: [
      {
        command: 'pnpm --filter @repo/contract test',
        exitCode: 0,
        durationMs: 1240,
        status: 'PASSED' as const,
        summary: 'All contract tests passed',
      },
    ],
    knownDefects: [],
    unresolvedIssues: [],
    securityImpact: 'Adds RLS-protected append-only audit tables',
    databaseImpact: 'Creates 3 new tables in migration 226',
    integrationImpact: 'Exports new contract schemas from @repo/contract',
    performanceImpact: 'Indexed on commit_sha, branch, agent_id, created_at',
    documentationUpdates: [],
    evidenceReferences: ['packages/database/migrations/226_quality_intelligence_engine.sql'],
    state: 'IMPLEMENTATION_COMPLETE' as const,
    submittedAt: SAMPLE_TIMESTAMP,
  };
}

function buildScoreBreakdown() {
  return {
    overallScore: 96.5,
    categoryScores: [
      {
        category: 'security' as const,
        weight: 0.25,
        score: 100,
        verified: 4,
        failed: 0,
        skipped: 0,
        unavailable: 0,
      },
      {
        category: 'functional_testing' as const,
        weight: 0.2,
        score: 95,
        verified: 5,
        failed: 0,
        skipped: 1,
        unavailable: 0,
      },
    ],
    confidencePct: 98,
    coveragePct: 92.4,
    securityRiskLevel: 'LOW' as const,
    mandatoryFailures: 0,
    releaseBlocked: false,
  };
}

function buildQualityCheckResult() {
  return {
    checkId: 'gate-contract-tests',
    name: 'Contract Jest Suite',
    category: 'testing' as const,
    scoringCategory: 'functional_testing' as const,
    owner: 'platform-qa',
    command: 'pnpm --filter @repo/contract test',
    mandatory: true,
    status: 'PASSED' as const,
    exitCode: 0,
    durationMs: 1240,
    skipReason: null,
    logExcerpt: 'Tests: 10 passed, 10 total',
    evidenceLinks: ['ci://runs/123'],
  };
}

function buildRunEvidence() {
  return {
    runId: SAMPLE_RUN_UUID,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: SAMPLE_COMMIT_END,
    parentCommitSha: SAMPLE_COMMIT_START,
    pullRequestId: 'PR-412',
    agentId: 'worker-1b',
    taskId: 'TASK-QIE-01B',
    executedAt: SAMPLE_TIMESTAMP,
    environment: 'ci',
    mode: 'full',
    overallStatus: 'PASSED' as const,
    checks: [buildQualityCheckResult()],
    regressions: [],
    score: buildScoreBreakdown(),
    evidenceSha256: SAMPLE_SHA256,
  };
}

describe('Quality Intelligence Enums', () => {
  it('accepts all valid enum literals and rejects invalid values', () => {
    expect(agentCompletionStateSchema.parse('VERIFICATION_PASSED')).toBe('VERIFICATION_PASSED');
    expect(agentCompletionStateSchema.safeParse('DONE_BY_SELF_CLAIM').success).toBe(false);

    expect(checkStatusSchema.parse('UNAVAILABLE')).toBe('UNAVAILABLE');
    expect(checkStatusSchema.safeParse('UNKNOWN').success).toBe(false);

    expect(gateCategorySchema.parse('agent_governance')).toBe('agent_governance');
    expect(gateCategorySchema.safeParse('random_gate').success).toBe(false);

    expect(scoringCategorySchema.parse('database_integrity')).toBe('database_integrity');
    expect(scoringCategorySchema.safeParse('vibe_score').success).toBe(false);

    expect(releaseStatusSchema.parse('ROLLBACK_REQUIRED')).toBe('ROLLBACK_REQUIRED');
    expect(releaseStatusSchema.safeParse('SHIPPED_YOLO').success).toBe(false);

    expect(severitySchema.parse('CRITICAL')).toBe('CRITICAL');
    expect(severitySchema.safeParse('EXTREME').success).toBe(false);
  });
});

describe('agentCompletionReportSchema', () => {
  it('validates a complete 26-field agent completion report', () => {
    const report = buildAgentCompletionReport();
    const result = agentCompletionReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it('rejects invalid commit SHAs and missing required fields', () => {
    const badSha = { ...buildAgentCompletionReport(), startingCommitSha: 'not-a-sha!' };
    expect(agentCompletionReportSchema.safeParse(badSha).success).toBe(false);

    const { taskDescription: _omitted, ...missingField } = buildAgentCompletionReport();
    expect(agentCompletionReportSchema.safeParse(missingField).success).toBe(false);
  });
});

describe('Quality Check, Regression, Score & Run Evidence Schemas', () => {
  it('validates check results, regression findings, category scores, and run evidence', () => {
    expect(qualityCheckResultSchema.safeParse(buildQualityCheckResult()).success).toBe(true);

    const regression = {
      id: 'REG-001',
      severity: 'HIGH' as const,
      category: 'security' as const,
      affectedPackage: '@repo/database',
      affectedFiles: ['packages/database/migrations/226_quality_intelligence_engine.sql'],
      previousResult: '0 RLS violations',
      currentResult: '1 unwrapped auth.uid()',
      difference: 'Missing InitPlan wrapper',
      suggestedRemediation: 'Wrap auth.uid() inside (SELECT auth.uid())',
      evidence: ['pnpm audit:rls-matrix'],
      isPreExisting: false,
    };
    expect(regressionFindingSchema.safeParse(regression).success).toBe(true);

    expect(
      categoryScoreSchema.safeParse({
        category: 'security',
        weight: 0.25,
        score: 100,
        verified: 4,
        failed: 0,
        skipped: 0,
        unavailable: 0,
      }).success
    ).toBe(true);

    expect(qualityScoreBreakdownSchema.safeParse(buildScoreBreakdown()).success).toBe(true);
    expect(qualityRunEvidenceSchema.safeParse(buildRunEvidence()).success).toBe(true);
  });

  it('rejects out-of-range scores and malformed SHA-256 evidence digests', () => {
    const overScore = { ...buildScoreBreakdown(), overallScore: 105 };
    expect(qualityScoreBreakdownSchema.safeParse(overScore).success).toBe(false);

    const emptyCategories = { ...buildScoreBreakdown(), categoryScores: [] };
    expect(qualityScoreBreakdownSchema.safeParse(emptyCategories).success).toBe(false);

    const badDigest = { ...buildRunEvidence(), evidenceSha256: 'deadbeef' };
    expect(qualityRunEvidenceSchema.safeParse(badDigest).success).toBe(false);
  });
});

describe('Agent Verification & Performance Metrics Schemas', () => {
  it('validates agentVerificationReportSchema and agentPerformanceMetricsSchema', () => {
    const verification = {
      verificationId: SAMPLE_VERIFICATION_UUID,
      agentReport: buildAgentCompletionReport(),
      actualChangedFiles: [
        'packages/contract/src/schemas/quality-intelligence.schema.ts',
        'packages/contract/src/index.ts',
      ],
      undeclaredFiles: [],
      missingDeclaredFiles: [],
      fileDiffMatches: true,
      computedState: 'VERIFICATION_PASSED' as const,
      runEvidence: buildRunEvidence(),
      verifiedBy: 'quality-intelligence-engine',
      verifiedAt: SAMPLE_TIMESTAMP,
      findings: [],
    };
    expect(agentVerificationReportSchema.safeParse(verification).success).toBe(true);

    const metrics = {
      agentId: 'worker-1b',
      agentName: 'Contracts & Migration Engineer',
      tasksCompleted: 12,
      tasksIndependentlyVerified: 12,
      firstPassVerificationSuccessCount: 11,
      firstPassSuccessRate: 91.67,
      defectsIntroduced: 0,
      regressionsIntroduced: 0,
      reopenedTasks: 1,
      testCoverageContribution: 94.5,
      securityFindingsIntroduced: 0,
      avgVerificationDurationMs: 18500,
      unresolvedBlockers: 0,
      documentationCompletenessPct: 100,
      evidenceCompletenessPct: 100,
      speedScore: 90,
      correctnessScore: 98,
      verificationQualityScore: 97,
      regressionRate: 0,
    };
    expect(agentPerformanceMetricsSchema.safeParse(metrics).success).toBe(true);
  });
});

describe('Release Certification Schemas', () => {
  it('validates a 10-requirement release certification and rejects empty requirements', () => {
    const categories = [
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
    ] as const;

    const requirements = categories.map((category, index) => ({
      requirementId: `REQ-${index + 1}`,
      name: `Mandatory Gate ${index + 1}`,
      category,
      mandatory: true,
      status: 'PASSED' as const,
      details: 'Verified cleanly',
      evidenceRef: `ci://gate/${index + 1}`,
    }));

    expect(releaseRequirementResultSchema.safeParse(requirements[0]).success).toBe(true);

    const cert = {
      commitSha: SAMPLE_COMMIT_END,
      status: 'APPROVED' as const,
      requirements,
      overallScore: 97.2,
      blockers: [],
      evidenceRunId: SAMPLE_RUN_UUID,
      certifiedAt: SAMPLE_TIMESTAMP,
      approvedBy: 'emp-admin-01',
      approvedAt: SAMPLE_TIMESTAMP,
      notes: 'All 10 mandatory gates verified',
    };
    expect(releaseCertificationSchema.safeParse(cert).success).toBe(true);

    expect(
      releaseCertificationSchema.safeParse({
        ...cert,
        requirements: [],
      }).success
    ).toBe(false);
  });
});

describe('Database Row Schemas', () => {
  it('validates snake_case DB rows for all 3 quality intelligence tables', () => {
    const runRow = {
      id: SAMPLE_UUID,
      run_id: SAMPLE_RUN_UUID,
      repository: 'Timothy191/Arch-System',
      branch: 'feature/quality-intelligence-engine',
      commit_sha: SAMPLE_COMMIT_END,
      parent_commit_sha: SAMPLE_COMMIT_START,
      pull_request_id: null,
      agent_id: 'worker-1b',
      task_id: 'TASK-QIE-01B',
      executed_at: SAMPLE_TIMESTAMP,
      environment: 'ci',
      mode: 'full',
      overall_status: 'PASSED' as const,
      overall_score: 96.5,
      confidence_pct: 98,
      coverage_pct: 92.4,
      security_risk_level: 'LOW' as const,
      mandatory_failures: 0,
      release_blocked: false,
      checks: [buildQualityCheckResult()],
      regressions: [],
      score_breakdown: buildScoreBreakdown(),
      evidence_sha256: SAMPLE_SHA256,
      created_by: SAMPLE_UUID,
      created_at: SAMPLE_TIMESTAMP,
    };
    expect(qualityVerificationRunRowSchema.safeParse(runRow).success).toBe(true);
    expect(qualityVerificationRunRowSchema.safeParse({ ...runRow, id: 'not-a-uuid' }).success).toBe(
      false
    );

    const reportRow = {
      id: SAMPLE_UUID,
      verification_id: SAMPLE_VERIFICATION_UUID,
      agent_id: 'worker-1b',
      agent_name: 'Contracts & Migration Engineer',
      task_id: 'TASK-QIE-01B',
      task_description: 'Define contracts and migration',
      starting_commit_sha: SAMPLE_COMMIT_START,
      ending_commit_sha: SAMPLE_COMMIT_END,
      declared_state: 'IMPLEMENTATION_COMPLETE' as const,
      computed_state: 'VERIFICATION_PASSED' as const,
      file_diff_matches: true,
      actual_changed_files: ['packages/contract/src/index.ts'],
      undeclared_files: [],
      missing_declared_files: [],
      agent_report: buildAgentCompletionReport(),
      findings: [],
      evidence_run_id: SAMPLE_RUN_UUID,
      verified_by: 'quality-intelligence-engine',
      verified_at: SAMPLE_TIMESTAMP,
      submitted_at: SAMPLE_TIMESTAMP,
      created_by: null,
      created_at: SAMPLE_TIMESTAMP,
    };
    expect(agentWorkReportRowSchema.safeParse(reportRow).success).toBe(true);

    const certRow = {
      id: SAMPLE_UUID,
      commit_sha: SAMPLE_COMMIT_END,
      branch: 'feature/quality-intelligence-engine',
      release_status: 'READY_FOR_REVIEW' as const,
      overall_score: 97.2,
      requirements: [
        {
          requirementId: 'REQ-1',
          name: 'Type-check',
          category: 'code_quality' as const,
          mandatory: true,
          status: 'PASSED' as const,
        },
      ],
      blockers: [],
      evidence_run_id: SAMPLE_RUN_UUID,
      certified_at: SAMPLE_TIMESTAMP,
      approved_by: null,
      approved_at: null,
      notes: null,
      created_by: SAMPLE_UUID,
      created_at: SAMPLE_TIMESTAMP,
      updated_at: SAMPLE_TIMESTAMP,
    };
    expect(qualityReleaseCertificationRowSchema.safeParse(certRow).success).toBe(true);
    expect(
      qualityReleaseCertificationRowSchema.safeParse({
        ...certRow,
        release_status: 'INVALID_STATUS',
      }).success
    ).toBe(false);
  });

  it('accepts PostgREST TIMESTAMPTZ offsets (+00:00, +02:00, -05:00) alongside Z across schemas and DB rows', () => {
    const postgrestUtc = '2026-11-19T14:30:00+00:00';
    const postgrestOffset = '2026-11-19T16:30:00.123456+02:00';
    const postgrestNegative = '2026-11-19T09:30:00-05:00';

    expect(
      agentCompletionReportSchema.safeParse({
        ...buildAgentCompletionReport(),
        submittedAt: postgrestOffset,
      }).success
    ).toBe(true);

    expect(
      qualityRunEvidenceSchema.safeParse({
        ...buildRunEvidence(),
        executedAt: postgrestUtc,
      }).success
    ).toBe(true);

    expect(
      agentVerificationReportSchema.safeParse({
        verificationId: SAMPLE_VERIFICATION_UUID,
        agentReport: { ...buildAgentCompletionReport(), submittedAt: postgrestOffset },
        actualChangedFiles: ['packages/contract/src/index.ts'],
        undeclaredFiles: [],
        missingDeclaredFiles: [],
        fileDiffMatches: true,
        computedState: 'VERIFICATION_PASSED',
        runEvidence: { ...buildRunEvidence(), executedAt: postgrestUtc },
        verifiedBy: 'quality-intelligence-engine',
        verifiedAt: postgrestNegative,
        findings: [],
      }).success
    ).toBe(true);

    expect(
      releaseCertificationSchema.safeParse({
        commitSha: SAMPLE_COMMIT_END,
        status: 'APPROVED',
        requirements: [
          {
            requirementId: 'REQ-1',
            name: 'Type-check',
            category: 'code_quality',
            mandatory: true,
            status: 'PASSED',
          },
        ],
        overallScore: 98,
        blockers: [],
        evidenceRunId: SAMPLE_RUN_UUID,
        certifiedAt: postgrestUtc,
        approvedBy: 'tim@arch-system.io',
        approvedAt: postgrestOffset,
        notes: 'Offset timestamp check',
      }).success
    ).toBe(true);

    expect(
      qualityVerificationRunRowSchema.safeParse({
        id: SAMPLE_UUID,
        run_id: SAMPLE_RUN_UUID,
        repository: 'Timothy191/Arch-System',
        branch: 'feature/quality-intelligence-engine',
        commit_sha: SAMPLE_COMMIT_END,
        parent_commit_sha: SAMPLE_COMMIT_START,
        pull_request_id: null,
        agent_id: 'worker-1b',
        task_id: 'TASK-QIE-01B',
        executed_at: postgrestUtc,
        environment: 'ci',
        mode: 'full',
        overall_status: 'PASSED',
        overall_score: 96.5,
        confidence_pct: 98,
        coverage_pct: 92.4,
        security_risk_level: 'LOW',
        mandatory_failures: 0,
        release_blocked: false,
        checks: [buildQualityCheckResult()],
        regressions: [],
        score_breakdown: buildScoreBreakdown(),
        evidence_sha256: SAMPLE_SHA256,
        created_by: SAMPLE_UUID,
        created_at: postgrestOffset,
      }).success
    ).toBe(true);

    expect(
      agentWorkReportRowSchema.safeParse({
        id: SAMPLE_UUID,
        verification_id: SAMPLE_VERIFICATION_UUID,
        agent_id: 'worker-1b',
        agent_name: 'Contracts & Migration Engineer',
        task_id: 'TASK-QIE-01B',
        task_description: 'Define contracts and migration',
        starting_commit_sha: SAMPLE_COMMIT_START,
        ending_commit_sha: SAMPLE_COMMIT_END,
        declared_state: 'IMPLEMENTATION_COMPLETE',
        computed_state: 'VERIFICATION_PASSED',
        file_diff_matches: true,
        actual_changed_files: ['packages/contract/src/index.ts'],
        undeclared_files: [],
        missing_declared_files: [],
        agent_report: { ...buildAgentCompletionReport(), submittedAt: postgrestOffset },
        findings: [],
        evidence_run_id: SAMPLE_RUN_UUID,
        verified_by: 'quality-intelligence-engine',
        verified_at: postgrestUtc,
        submitted_at: postgrestOffset,
        created_by: null,
        created_at: postgrestNegative,
      }).success
    ).toBe(true);

    expect(
      qualityReleaseCertificationRowSchema.safeParse({
        id: SAMPLE_UUID,
        commit_sha: SAMPLE_COMMIT_END,
        branch: 'feature/quality-intelligence-engine',
        release_status: 'APPROVED',
        overall_score: 97.2,
        requirements: [
          {
            requirementId: 'REQ-1',
            name: 'Type-check',
            category: 'code_quality',
            mandatory: true,
            status: 'PASSED',
          },
        ],
        blockers: [],
        evidence_run_id: SAMPLE_RUN_UUID,
        certified_at: postgrestUtc,
        approved_by: SAMPLE_UUID,
        approved_at: postgrestOffset,
        notes: null,
        created_by: SAMPLE_UUID,
        created_at: postgrestNegative,
        updated_at: postgrestOffset,
      }).success
    ).toBe(true);
  });
});
