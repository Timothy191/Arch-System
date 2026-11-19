/** @jest-environment node */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { QualityRunEvidence } from '@repo/contract';
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

jest.mock('@/lib/quality-intelligence/evidence-loader', () => ({
  loadQualityIntelligenceSnapshot: jest.fn(),
}));

import {
  loadQualityIntelligenceSnapshot,
  type QualityIntelligenceSnapshot,
} from '@/lib/quality-intelligence/evidence-loader';
import { GET } from './route';

const RUN_ID_1 = '11111111-1111-4111-8111-111111111111';
const COMMIT_SHA_1 = 'a51e5172e10771a840ca009774d011cc6911da5a';
const EVIDENCE_SHA256 = 'b'.repeat(64);

function buildEmptySnapshot(
  filters: QualityIntelligenceSnapshot['filters'] = {}
): QualityIntelligenceSnapshot {
  return {
    source: 'none',
    loadedAt: '2026-11-19T14:55:00.000Z',
    filters,
    latestRun: null,
    runs: [],
    agentReports: [],
    agentPerformance: [],
    certifications: [],
    latestCertification: null,
    agentVerifyEvidence: null,
    unavailableReasons: ['No verified quality evidence available.'],
  };
}

function buildValidRun(overrides: Partial<QualityRunEvidence> = {}): QualityRunEvidence {
  return {
    runId: RUN_ID_1,
    repository: 'Timothy191/Arch-System',
    branch: 'feature/quality-intelligence-engine',
    commitSha: COMMIT_SHA_1,
    parentCommitSha: null,
    pullRequestId: '42',
    agentId: 'worker-3a',
    taskId: 'qi-control-room',
    executedAt: '2026-11-19T14:55:00.000Z',
    environment: 'local',
    mode: 'pr',
    overallStatus: 'PASSED',
    checks: [
      {
        checkId: 'type-check',
        name: 'TypeScript Check',
        category: 'code_quality',
        scoringCategory: 'architecture',
        owner: 'control-room',
        command: 'pnpm --filter portal type-check',
        mandatory: true,
        status: 'PASSED',
        exitCode: 0,
        durationMs: 1200,
        skipReason: null,
        logExcerpt: null,
        evidenceLinks: ['.ci-local/quality-intelligence'],
      },
    ],
    regressions: [],
    score: {
      overallScore: 95,
      categoryScores: [
        {
          category: 'architecture',
          weight: 0.15,
          score: 100,
          verified: 1,
          failed: 0,
          skipped: 0,
          unavailable: 0,
        },
      ],
      confidencePct: 100,
      coveragePct: 12.5,
      securityRiskLevel: 'LOW',
      mandatoryFailures: 0,
      releaseBlocked: false,
    },
    evidenceSha256: EVIDENCE_SHA256,
    ...overrides,
  };
}

describe('GET /api/control-room/quality-intelligence', () => {
  const mockSupabase = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase as never);
    jest.mocked(loadQualityIntelligenceSnapshot).mockResolvedValue(buildEmptySnapshot());
  });

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/control-room/quality-intelligence');
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(loadQualityIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('returns 403 for unauthorized viewer role', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-viewer-1' },
      employee: { id: 'emp-viewer-1', role: 'viewer', department_id: 'control-room' },
    } as never);

    const req = new Request('http://localhost/api/control-room/quality-intelligence');
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(loadQualityIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('returns 403 for generic operator role', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-operator-1' },
      employee: { id: 'emp-operator-1', role: 'operator', department_id: 'drilling' },
    } as never);

    const req = new Request('http://localhost/api/control-room/quality-intelligence');
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(loadQualityIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid query filter parameters', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-bad-query' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);

    const req = new Request(
      'http://localhost/api/control-room/quality-intelligence?date=19-11-2026&severity=EXTREME'
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(loadQualityIntelligenceSnapshot).not.toHaveBeenCalled();
  });

  it('returns 200 with canCertify=false for control_room_operator and passes validated filters', async () => {
    const run = buildValidRun();
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-cro-1' },
      employee: { id: 'emp-cro-1', role: 'control_room_operator', department_id: 'control-room' },
    } as never);
    jest.mocked(loadQualityIntelligenceSnapshot).mockResolvedValueOnce({
      ...buildEmptySnapshot({
        agent: 'worker-3a',
        department: 'control-room',
        pkg: 'portal',
        branch: 'feature/quality-intelligence-engine',
        commit: 'a51e517',
        pr: '42',
        severity: 'LOW',
        date: '2026-11-19',
        status: 'PASSED',
      }),
      source: 'local_artifacts',
      latestRun: run,
      runs: [run],
      unavailableReasons: [],
    });

    const req = new Request(
      'http://localhost/api/control-room/quality-intelligence?agent=worker-3a&department=control-room&package=portal&branch=feature/quality-intelligence-engine&commit=a51e517&pr=42&severity=LOW&date=2026-11-19&status=PASSED'
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(json.success).toBe(true);
    expect(json.canCertify).toBe(false);
    expect(json.source).toBe('local_artifacts');
    expect(json.runs).toHaveLength(1);
    expect(loadQualityIntelligenceSnapshot).toHaveBeenCalledWith({
      supabase: mockSupabase,
      filters: {
        agent: 'worker-3a',
        department: 'control-room',
        pkg: 'portal',
        branch: 'feature/quality-intelligence-engine',
        commit: 'a51e517',
        pr: '42',
        severity: 'LOW',
        date: '2026-11-19',
        status: 'PASSED',
      },
    });
  });

  it('returns 200 with canCertify=true for admin and honest empty state when no evidence exists', async () => {
    jest.mocked(getAuthenticatedEmployee).mockResolvedValueOnce({
      user: { id: 'user-admin-empty' },
      employee: { id: 'emp-admin-1', role: 'admin', department_id: 'control-room' },
    } as never);
    jest.mocked(loadQualityIntelligenceSnapshot).mockResolvedValueOnce(buildEmptySnapshot());

    const req = new Request('http://localhost/api/control-room/quality-intelligence');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(json.success).toBe(true);
    expect(json.canCertify).toBe(true);
    expect(json.source).toBe('none');
    expect(json.latestRun).toBeNull();
    expect(json.runs).toEqual([]);
    expect(json.agentReports).toEqual([]);
    expect(json.certifications).toEqual([]);
  });
});

describe('loadQualityIntelligenceSnapshot (evidence-loader)', () => {
  const actualLoader = jest.requireActual<
    typeof import('@/lib/quality-intelligence/evidence-loader')
  >('@/lib/quality-intelligence/evidence-loader');

  let tempArtifactsDir: string;

  beforeEach(async () => {
    tempArtifactsDir = await mkdtemp(path.join(os.tmpdir(), 'qi-evidence-loader-'));
  });

  afterEach(async () => {
    await rm(tempArtifactsDir, { recursive: true, force: true });
  });

  it('falls back to read-only local artifacts when Supabase tables are not migrated (42P01) and redacts secrets', async () => {
    const qualityDir = path.join(tempArtifactsDir, 'quality-intelligence');
    await mkdir(path.join(qualityDir, 'runs'), { recursive: true });

    const runWithSecret = buildValidRun({
      checks: [
        {
          checkId: 'type-check',
          name: 'TypeScript Check',
          category: 'code_quality',
          scoringCategory: 'architecture',
          owner: 'control-room',
          command: 'SUPABASE_API_KEY=sk_live_secret123456 pnpm --filter portal type-check',
          mandatory: true,
          status: 'PASSED',
          exitCode: 0,
          durationMs: 900,
          skipReason: null,
          logExcerpt: 'Authorization: Bearer my-secret-jwt-token',
          evidenceLinks: ['.ci-local/quality-intelligence'],
        },
      ],
    });
    await writeFile(path.join(qualityDir, 'latest.json'), JSON.stringify(runWithSecret), 'utf8');

    const missingTableBuilder = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42P01',
          message: 'relation "public.quality_verification_runs" does not exist',
        },
      }),
    };
    const fakeSupabase = {
      from: jest.fn().mockReturnValue(missingTableBuilder),
    };

    const snapshot = await actualLoader.loadQualityIntelligenceSnapshot({
      supabase: fakeSupabase as never,
      artifactsRootDir: tempArtifactsDir,
      filters: { department: 'control-room' },
    });

    expect(snapshot.source).toBe('local_artifacts');
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.latestRun?.checks[0]?.command).not.toContain('sk_live_secret123456');
    expect(snapshot.latestRun?.checks[0]?.command).toContain('[REDACTED]');
    expect(snapshot.latestRun?.checks[0]?.logExcerpt).toContain('Bearer [REDACTED]');
    expect(snapshot.unavailableReasons.some((reason) => reason.includes('42P01'))).toBe(true);
  });

  it('returns honest empty payload when neither DB nor local artifacts exist', async () => {
    const snapshot = await actualLoader.loadQualityIntelligenceSnapshot({
      artifactsRootDir: tempArtifactsDir,
    });

    expect(snapshot.source).toBe('none');
    expect(snapshot.latestRun).toBeNull();
    expect(snapshot.runs).toEqual([]);
    expect(snapshot.agentReports).toEqual([]);
    expect(snapshot.certifications).toEqual([]);
  });
});
