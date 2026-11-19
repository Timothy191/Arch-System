/** @jest-environment node */
import type { QualityCheckResult, QualityRunEvidence } from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';

jest.mock('next/server', () => ({
  NextRequest: Request,
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
      headers: new Headers(init?.headers),
    }),
  },
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/logger/server', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTag: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/quality-intelligence/evidence-loader', () => ({
  loadQualityIntelligenceSnapshot: jest.fn(),
}));

import { computeEvidenceSha256 } from '@repo/intelligence/quality';
import {
  loadQualityIntelligenceSnapshot,
  type QualityIntelligenceSnapshot,
} from '@/lib/quality-intelligence/evidence-loader';
import { updateTag } from '@/lib/server-cache';
import { POST } from './route';

const RUN_ID = '22222222-2222-4222-8222-222222222222';
const COMMIT_SHA = 'c3f8a91d2b4e5f60718293a4b5c6d7e8f9012345';

function buildCheck(
  checkId: string,
  category: QualityCheckResult['category'],
  scoringCategory: QualityCheckResult['scoringCategory'],
  status: QualityCheckResult['status'] = 'PASSED'
): QualityCheckResult {
  return {
    checkId,
    name: checkId,
    category,
    scoringCategory,
    owner: 'platform',
    command: `pnpm ${checkId}`,
    mandatory: true,
    status,
    exitCode: status === 'PASSED' ? 0 : 1,
    durationMs: 500,
    skipReason: null,
    logExcerpt: null,
    evidenceLinks: ['.ci-local/quality-intelligence'],
  };
}

function buildPassingRun(): QualityRunEvidence {
  const baseRun = {
    runId: RUN_ID,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: COMMIT_SHA,
    parentCommitSha: null,
    pullRequestId: null,
    agentId: 'worker-3a',
    taskId: 'qi-certify',
    executedAt: '2026-11-19T14:55:00.000Z',
    environment: 'local',
    mode: 'release',
    overallStatus: 'PASSED' as const,
    checks: [
      buildCheck('type-check', 'code_quality', 'architecture', 'PASSED'),
      buildCheck('unit-tests', 'testing', 'functional_testing', 'PASSED'),
      buildCheck('security-policy', 'security', 'security', 'PASSED'),
      buildCheck('migration-lint', 'database', 'database_integrity', 'PASSED'),
      buildCheck('policy-check', 'architecture', 'architecture', 'PASSED'),
      buildCheck('health-check', 'reliability', 'reliability', 'PASSED'),
      buildCheck('vercel-preflight', 'infrastructure', 'performance', 'PASSED'),
    ],
    regressions: [],
    score: {
      overallScore: 98,
      categoryScores: [
        {
          category: 'security' as const,
          weight: 0.2,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
      ],
      confidencePct: 100,
      coveragePct: 75,
      securityRiskLevel: 'LOW' as const,
      mandatoryFailures: 0,
      releaseBlocked: false,
    },
  };
  return {
    ...baseRun,
    evidenceSha256: computeEvidenceSha256(baseRun),
  };
}

function buildFailingRun(): QualityRunEvidence {
  const base = buildPassingRun();
  return {
    ...base,
    overallStatus: 'FAILED',
    checks: [
      buildCheck('type-check', 'code_quality', 'architecture', 'FAILED'),
      ...base.checks.slice(1),
    ],
    score: {
      ...base.score,
      overallScore: 62,
      mandatoryFailures: 1,
      releaseBlocked: true,
    },
  };
}

function buildSnapshotWithRun(run: QualityRunEvidence | null): QualityIntelligenceSnapshot {
  return {
    source: run ? 'local_artifacts' : 'none',
    loadedAt: '2026-11-19T14:55:00.000Z',
    filters: { commit: COMMIT_SHA },
    latestRun: run,
    runs: run ? [run] : [],
    agentReports: [],
    agentPerformance: [],
    certifications: [],
    latestCertification: null,
    agentVerifyEvidence: null,
    unavailableReasons: [],
  };
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/control-room/quality-intelligence/certify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/control-room/quality-intelligence/certify', () => {
  const singleMock = jest.fn();
  const selectMock = jest.fn(() => ({ single: singleMock }));
  const insertMock = jest.fn(() => ({ select: selectMock }));
  const mockSupabase = {
    from: jest.fn(() => ({ insert: insertMock })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as never);
    singleMock.mockResolvedValue({ data: { id: 'cert-row-1' }, error: null });
    jest
      .mocked(loadQualityIntelligenceSnapshot)
      .mockResolvedValue(buildSnapshotWithRun(buildPassingRun()));
  });

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce(null);

    const res = await POST(
      makePostRequest({ commitSha: COMMIT_SHA, action: 'APPROVE', notes: 'Looks good' })
    );

    expect(res.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 403 when control_room_operator attempts to certify', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-cro-cert' },
      employee: { id: 'emp-cro-1', role: 'control_room_operator', department_id: 'control-room' },
    } as never);

    const res = await POST(
      makePostRequest({ commitSha: COMMIT_SHA, action: 'APPROVE', notes: 'Attempting approval' })
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-bad-payload' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);

    const res = await POST(makePostRequest({ commitSha: 'not-a-sha!', action: 'APPROVE' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(loadQualityIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('returns 422 and blocks approval when mandatory technical checks failed', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-blocked' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);
    jest
      .mocked(loadQualityIntelligenceSnapshot)
      .mockResolvedValueOnce(buildSnapshotWithRun(buildFailingRun()));

    const res = await POST(
      makePostRequest({ commitSha: COMMIT_SHA, action: 'APPROVE', notes: 'Force approve' })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RELEASE_CERTIFICATION_BLOCKED');
    expect(json.certification.status).toBe('BLOCKED');
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('returns 200 for authorized admin certification, persists row, and invalidates cache tag', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-approve' },
      employee: {
        id: '33333333-3333-4333-8333-333333333333',
        role: 'admin',
        department_id: 'control-room',
      },
    } as never);

    const res = await POST(
      makePostRequest({
        commitSha: COMMIT_SHA,
        action: 'APPROVE',
        notes: 'Verified all mandatory gates pass',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(json.success).toBe(true);
    expect(json.persisted).toBe(true);
    expect(json.persistenceReason).toBeNull();
    expect(json.certification.status).toBe('APPROVED');
    expect(json.certification.commitSha).toBe(COMMIT_SHA);
    expect(mockSupabase.from).toHaveBeenCalledWith('quality_release_certifications');
    expect(updateTag).toHaveBeenCalledWith('dept:control-room:quality-intelligence');
  });

  it('returns explicit persisted=false when quality_release_certifications table is not migrated yet', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-supervisor-approve' },
      employee: {
        id: '44444444-4444-4444-8444-444444444444',
        role: 'supervisor',
        department_id: 'control-room',
      },
    } as never);
    singleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42P01',
        message: 'relation "public.quality_release_certifications" does not exist',
      },
    });

    const res = await POST(
      makePostRequest({ commitSha: COMMIT_SHA, action: 'APPROVE', notes: 'Supervisor sign-off' })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.persisted).toBe(false);
    expect(json.persistenceReason).toContain('not migrated');
    expect(json.certification.status).toBe('APPROVED');
    expect(updateTag).toHaveBeenCalledWith('dept:control-room:quality-intelligence');
  });

  it('returns 409 when client submits a stale evidenceSha256 digest', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-stale-digest' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);

    const res = await POST(
      makePostRequest({
        commitSha: COMMIT_SHA,
        action: 'APPROVE',
        evidenceSha256: 'd'.repeat(64),
        notes: 'Stale digest click',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('EVIDENCE_DIGEST_MISMATCH');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 422 when matched run has a fabricated 64-char evidenceSha256 digest', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-fabricated-digest' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);
    jest.mocked(loadQualityIntelligenceSnapshot).mockResolvedValueOnce(
      buildSnapshotWithRun({
        ...buildPassingRun(),
        evidenceSha256: 'a'.repeat(64),
      })
    );

    const res = await POST(
      makePostRequest({
        commitSha: COMMIT_SHA,
        action: 'APPROVE',
        notes: 'Fabricated digest attempt',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RELEASE_CERTIFICATION_BLOCKED');
    expect(json.certification.status).toBe('BLOCKED');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 422 when a mandatory check in a passing category is SKIPPED', async () => {
    const passing = buildPassingRun();
    const checksWithSkippedMandatory = [
      ...passing.checks,
      buildCheck('biome-lint', 'code_quality', 'architecture', 'SKIPPED'),
    ];
    const tamperedBase = { ...passing, checks: checksWithSkippedMandatory };
    const skippedRun: QualityRunEvidence = {
      ...tamperedBase,
      evidenceSha256: computeEvidenceSha256(tamperedBase),
    };

    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-skipped-mandatory' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);
    jest
      .mocked(loadQualityIntelligenceSnapshot)
      .mockResolvedValueOnce(buildSnapshotWithRun(skippedRun));

    const res = await POST(
      makePostRequest({
        commitSha: COMMIT_SHA,
        action: 'APPROVE',
        evidenceSha256: skippedRun.evidenceSha256,
        notes: 'Skipped check attempt',
      })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RELEASE_CERTIFICATION_BLOCKED');
    expect(insertMock).not.toHaveBeenCalled();
  });
});
