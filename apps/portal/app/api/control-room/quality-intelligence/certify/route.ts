import {
  gitShaSchema,
  type QualityRunEvidence,
  type ReleaseCertification,
  z,
} from '@repo/contract';
import { evaluateReleaseCertification, redactSecrets } from '@repo/intelligence/quality';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

import { tagDepartment } from '@/lib/cache-tags';
import { logError } from '@/lib/errors/error-logger';
import { loadQualityIntelligenceSnapshot } from '@/lib/quality-intelligence/evidence-loader';
import { updateTag } from '@/lib/server-cache';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const MAX_BODY_BYTES = 1024 * 1024;
const CERTIFY_RATE_LIMIT_MAX = 10;
const CERTIFY_RATE_LIMIT_WINDOW_MS = 60_000;
const RETRY_AFTER_FALLBACK_SECONDS = 60;
const UNDEFINED_TABLE_PG_CODE = '42P01';
const POSTGREST_MISSING_TABLE_CODE = 'PGRST205';
const FOREIGN_KEY_VIOLATION_PG_CODE = '23503';

const CERTIFY_ALLOWED_ROLES = new Set(['admin', 'supervisor']);

const qualityCertifyLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: CERTIFY_RATE_LIMIT_MAX,
  windowMs: CERTIFY_RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:control_room_quality_certify:',
});

const certifyActionSchema = z.enum(['APPROVE', 'BLOCK', 'MARK_ROLLBACK_REQUIRED']);
const evidenceSha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'Evidence SHA-256 digest must be 64 hexadecimal characters');

const certifyRequestSchema = z.object({
  commitSha: gitShaSchema,
  action: certifyActionSchema,
  evidenceSha256: evidenceSha256Schema.optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

type CertifyAction = z.infer<typeof certifyActionSchema>;

interface PersistResult {
  readonly persisted: boolean;
  readonly persistenceReason: string | null;
  readonly recordId: string | null;
  readonly fatalError: { readonly message: string } | null;
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

function findMatchingRun(
  runs: readonly QualityRunEvidence[],
  commitSha: string
): QualityRunEvidence | null {
  const normalizedTarget = commitSha.trim().toLowerCase();
  const exactMatch = runs.find((run) => run.commitSha.toLowerCase() === normalizedTarget);
  if (exactMatch) {
    return exactMatch;
  }
  return runs.find((run) => run.commitSha.toLowerCase().startsWith(normalizedTarget)) ?? null;
}

function buildFinalCertification(options: {
  readonly evaluated: ReleaseCertification;
  readonly action: CertifyAction;
  readonly actorEmployeeId: string;
  readonly sanitizedNotes: string | null;
}): ReleaseCertification {
  const { evaluated, action, actorEmployeeId, sanitizedNotes } = options;
  if (action === 'APPROVE') {
    return evaluated;
  }
  if (action === 'BLOCK') {
    const manualBlocker = `Manual release block recorded by ${actorEmployeeId}${
      sanitizedNotes ? `: ${sanitizedNotes}` : ''
    }`;
    return {
      ...evaluated,
      status: 'BLOCKED',
      approvedBy: null,
      approvedAt: null,
      blockers: evaluated.blockers.length > 0 ? evaluated.blockers : [manualBlocker],
    };
  }
  const rollbackBlocker = `Rollback required by ${actorEmployeeId}${
    sanitizedNotes ? `: ${sanitizedNotes}` : ''
  }`;
  return {
    ...evaluated,
    status: 'ROLLBACK_REQUIRED',
    approvedBy: null,
    approvedAt: null,
    blockers: [rollbackBlocker, ...evaluated.blockers],
  };
}

async function persistCertification(options: {
  readonly supabase: ServerSupabaseClient;
  readonly certification: ReleaseCertification;
  readonly branch: string;
  readonly actorEmployeeId: string;
}): Promise<PersistResult> {
  const { supabase, certification, branch, actorEmployeeId } = options;
  const { data: insertedRow, error: insertError } = await supabase
    .from('quality_release_certifications')
    .insert({
      commit_sha: certification.commitSha,
      branch,
      release_status: certification.status,
      overall_score: certification.overallScore,
      requirements: certification.requirements,
      blockers: certification.blockers,
      evidence_run_id: certification.evidenceRunId,
      certified_at: certification.certifiedAt,
      approved_by: certification.status === 'APPROVED' ? actorEmployeeId : null,
      approved_at: certification.approvedAt ?? null,
      notes: certification.notes ?? null,
      created_by: actorEmployeeId,
    })
    .select('id')
    .single();

  if (!insertError) {
    return {
      persisted: true,
      persistenceReason: null,
      recordId: typeof insertedRow?.id === 'string' ? insertedRow.id : null,
      fatalError: null,
    };
  }

  if (isMissingTableError(insertError)) {
    return {
      persisted: false,
      persistenceReason: 'Table quality_release_certifications is not migrated yet.',
      recordId: null,
      fatalError: null,
    };
  }

  if (insertError.code === FOREIGN_KEY_VIOLATION_PG_CODE) {
    return {
      persisted: false,
      persistenceReason:
        'Referenced verification run is not persisted in quality_verification_runs.',
      recordId: null,
      fatalError: null,
    };
  }

  return {
    persisted: false,
    persistenceReason: insertError.message,
    recordId: null,
    fatalError: { message: insertError.message },
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: HTTP_UNAUTHORIZED, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 2. Authorize (admin and supervisor ONLY)
    if (!principal.employee || !CERTIFY_ALLOWED_ROLES.has(principal.employee.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Forbidden: Only administrators and supervisors may certify releases',
            code: 'FORBIDDEN',
          },
        },
        { status: HTTP_FORBIDDEN, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Validate request body
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: { message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' } },
        { status: HTTP_PAYLOAD_TOO_LARGE, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: { message: 'Malformed JSON body', code: 'INVALID_JSON' } },
        { status: HTTP_BAD_REQUEST, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const parsedBody = certifyRequestSchema.safeParse(parsedJson);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: parsedBody.error.issues[0]?.message ?? 'Invalid certification payload',
            code: 'VALIDATION_ERROR',
            details: parsedBody.error.issues,
          },
        },
        { status: HTTP_BAD_REQUEST, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Rate-limit (10 req/min per user)
    const rateLimitResult = await qualityCertifyLimiter.check(principal.user.id);
    if (!rateLimitResult.allowed) {
      const retryAfterSec = rateLimitResult.retryAfter ?? RETRY_AFTER_FALLBACK_SECONDS;
      return NextResponse.json(
        { success: false, error: { message: 'Rate limit exceeded', code: 'RATE_LIMITED' } },
        {
          status: HTTP_TOO_MANY_REQUESTS,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(retryAfterSec),
          },
        }
      );
    }

    // 5. Evaluate release certification against verified run for commitSha
    const { commitSha, action, evidenceSha256, notes } = parsedBody.data;
    const sanitizedNotes = notes ? redactSecrets(notes) : null;
    const snapshot = await loadQualityIntelligenceSnapshot({
      supabase,
      filters: { commit: commitSha },
    });
    const matchedRun = findMatchingRun(snapshot.runs, commitSha);
    if (!matchedRun) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `No verified quality run evidence found for commit ${commitSha}`,
            code: 'EVIDENCE_NOT_FOUND',
          },
        },
        { status: HTTP_NOT_FOUND, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (
      evidenceSha256 &&
      evidenceSha256.toLowerCase() !== matchedRun.evidenceSha256.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              'Provided evidenceSha256 digest does not match the latest verified run for this commit.',
            code: 'EVIDENCE_DIGEST_MISMATCH',
          },
        },
        { status: HTTP_CONFLICT, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const nowIso = new Date().toISOString();
    const evaluated = evaluateReleaseCertification({
      commitSha: matchedRun.commitSha,
      runEvidence: matchedRun,
      expectedEvidenceSha256: evidenceSha256 ?? matchedRun.evidenceSha256,
      hasAuthorizedApproval: action === 'APPROVE',
      approvedBy: action === 'APPROVE' ? principal.employee.id : null,
      approvedAt: action === 'APPROVE' ? nowIso : null,
      notes: sanitizedNotes,
      certifiedAt: nowIso,
    });

    if (action === 'APPROVE' && evaluated.status === 'BLOCKED') {
      logger.warn(
        {
          event: 'control_room_quality_certification_blocked',
          actorId: principal.user.id,
          employeeId: principal.employee.id,
          commitSha: matchedRun.commitSha,
          blockers: evaluated.blockers,
        },
        'Release certification approval rejected because mandatory technical checks failed or are unverified'
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              'Cannot approve release certification: mandatory technical requirements failed or are unavailable.',
            code: 'RELEASE_CERTIFICATION_BLOCKED',
          },
          certification: evaluated,
        },
        { status: HTTP_UNPROCESSABLE_ENTITY, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const finalCertification = buildFinalCertification({
      evaluated,
      action,
      actorEmployeeId: principal.employee.id,
      sanitizedNotes,
    });

    const persistResult = await persistCertification({
      supabase,
      certification: finalCertification,
      branch: matchedRun.branch,
      actorEmployeeId: principal.employee.id,
    });

    if (persistResult.fatalError) {
      throw new Error(persistResult.fatalError.message);
    }

    // 6. Audit log
    logger.info(
      {
        event: 'control_room_quality_certification_recorded',
        actorId: principal.user.id,
        employeeId: principal.employee.id,
        role: principal.employee.role,
        action,
        commitSha: finalCertification.commitSha,
        releaseStatus: finalCertification.status,
        persisted: persistResult.persisted,
        persistenceReason: persistResult.persistenceReason,
      },
      'Control Room quality release certification evaluated'
    );

    // 7. Invalidate cache tag
    await updateTag(tagDepartment('control-room', 'quality-intelligence'));

    // 8. Return typed JSON certification result
    return NextResponse.json(
      {
        success: true,
        action,
        certification: finalCertification,
        persisted: persistResult.persisted,
        persistenceReason: persistResult.persistenceReason,
        recordId: persistResult.recordId,
      },
      { status: HTTP_OK, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    logError(error, { context: 'control_room_quality_certify_post' });
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
