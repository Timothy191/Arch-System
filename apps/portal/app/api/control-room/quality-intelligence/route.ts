import {
  agentCompletionStateSchema,
  checkStatusSchema,
  releaseStatusSchema,
  severitySchema,
  z,
} from '@repo/contract';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';
import {
  loadQualityIntelligenceSnapshot,
  type QualityIntelligenceFilters,
} from '@/lib/quality-intelligence/evidence-loader';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const READ_RATE_LIMIT_MAX = 60;
const READ_RATE_LIMIT_WINDOW_MS = 60_000;
const RETRY_AFTER_FALLBACK_SECONDS = 60;

const ALLOWED_READ_ROLES = new Set(['admin', 'supervisor', 'control_room_operator']);
const CERTIFY_ALLOWED_ROLES = new Set(['admin', 'supervisor']);

const qualityReadLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: READ_RATE_LIMIT_MAX,
  windowMs: READ_RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:control_room_quality_read:',
});

const statusFilterSchema = z.union([
  checkStatusSchema,
  releaseStatusSchema,
  agentCompletionStateSchema,
]);

const qualityQuerySchema = z.object({
  agent: z.string().trim().min(1).max(128).optional(),
  department: z.string().trim().min(1).max(128).optional(),
  package: z.string().trim().min(1).max(256).optional(),
  pkg: z.string().trim().min(1).max(256).optional(),
  branch: z.string().trim().min(1).max(256).optional(),
  commit: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{4,40}$/i, 'Commit filter must be 4-40 hex characters')
    .optional(),
  pr: z.string().trim().min(1).max(64).optional(),
  severity: severitySchema.optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date filter must use YYYY-MM-DD format')
    .optional(),
  status: statusFilterSchema.optional(),
});

function extractQueryParams(requestUrl: string): Record<string, string> {
  const url = new URL(requestUrl, 'http://localhost');
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (value.trim().length > 0) {
      params[key] = value;
    }
  }
  return params;
}

export async function GET(req: Request): Promise<NextResponse> {
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

    // 2. Authorize
    if (!principal.employee || !ALLOWED_READ_ROLES.has(principal.employee.role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
        { status: HTTP_FORBIDDEN, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Validate query params
    const rawParams = extractQueryParams(req.url);
    const parsedQuery = qualityQuerySchema.safeParse(rawParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters',
            code: 'VALIDATION_ERROR',
            details: parsedQuery.error.issues,
          },
        },
        { status: HTTP_BAD_REQUEST, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Rate-limit (60 req/min per user)
    const rateLimitResult = await qualityReadLimiter.check(principal.user.id);
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

    // 5. Execute filtered evidence load
    const filters: QualityIntelligenceFilters = {
      agent: parsedQuery.data.agent,
      department: parsedQuery.data.department,
      pkg: parsedQuery.data.package ?? parsedQuery.data.pkg,
      branch: parsedQuery.data.branch,
      commit: parsedQuery.data.commit,
      pr: parsedQuery.data.pr,
      severity: parsedQuery.data.severity,
      date: parsedQuery.data.date,
      status: parsedQuery.data.status,
    };
    const snapshot = await loadQualityIntelligenceSnapshot({ supabase, filters });
    const canCertify = CERTIFY_ALLOWED_ROLES.has(principal.employee.role);

    // 6. Audit log
    logger.info(
      {
        event: 'control_room_quality_intelligence_read',
        actorId: principal.user.id,
        employeeId: principal.employee.id,
        role: principal.employee.role,
        source: snapshot.source,
        runCount: snapshot.runs.length,
        agentReportCount: snapshot.agentReports.length,
        certificationCount: snapshot.certifications.length,
        filters,
      },
      'Control Room quality intelligence snapshot retrieved'
    );

    // 7. Return typed JSON with Cache-Control: no-store
    return NextResponse.json(
      {
        success: true,
        canCertify,
        ...snapshot,
      },
      {
        status: HTTP_OK,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: unknown) {
    logError(error, { context: 'control_room_quality_intelligence_get' });
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'API_ERROR' } },
      { status: HTTP_INTERNAL_ERROR, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
