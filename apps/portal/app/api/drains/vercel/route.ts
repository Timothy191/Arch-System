import { createLogger } from '@repo/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { verifyVercelSignature } from '@/lib/api/vercel-signature';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

const logger = createLogger('portal:vercel-drains');

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const MAX_RECENT_DRAIN_BATCHES = 50;
const ERROR_STATUS_CODE_THRESHOLD = 500;

export const VERCEL_LOG_DRAIN_SOURCES = [
  'build',
  'edge',
  'external',
  'lambda',
  'static',
  'firewall',
] as const;

export type VercelLogDrainSource = (typeof VERCEL_LOG_DRAIN_SOURCES)[number];
export type VercelDrainCategory = 'logs' | 'traces' | 'speed_insights' | 'web_analytics';

export interface VercelDrainBatchSummary {
  readonly batchId: string;
  readonly receivedAtIso: string;
  readonly contentType: string;
  readonly totalRecords: number;
  readonly breakdown: Readonly<Record<VercelDrainCategory, number>>;
  readonly errorLogCount: number;
}

const LOG_SOURCE_SET: ReadonlySet<string> = new Set(VERCEL_LOG_DRAIN_SOURCES);
const WEB_VITALS_SET: ReadonlySet<string> = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']);

const recentDrainBatches: VercelDrainBatchSummary[] = [];

function resolveDrainSecret(): string | undefined {
  return (
    process.env.VERCEL_DRAIN_SECRET ||
    process.env.VERCEL_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET
  );
}

function buildVerifyHeaders(req: NextRequest): HeadersInit {
  const verifyToken =
    process.env.VERCEL_DRAIN_VERIFY || req.headers.get('x-vercel-verify') || undefined;
  if (!verifyToken) {
    return {};
  }
  return { 'x-vercel-verify': verifyToken };
}

function parseDrainRecords(rawBody: string, contentType: string): Record<string, unknown>[] | null {
  const trimmedBody = rawBody.trim();
  if (trimmedBody.length === 0) {
    return [];
  }

  const isNdjson =
    contentType.includes('application/x-ndjson') ||
    (trimmedBody.includes('\n') && !trimmedBody.startsWith('['));

  if (isNdjson) {
    const lines = trimmedBody
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const parsedRecords: Record<string, unknown>[] = [];
    for (const line of lines) {
      try {
        const parsedLine: unknown = JSON.parse(line);
        if (typeof parsedLine === 'object' && parsedLine !== null && !Array.isArray(parsedLine)) {
          parsedRecords.push(parsedLine as Record<string, unknown>);
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }
    return parsedRecords;
  }

  try {
    const parsedPayload: unknown = JSON.parse(trimmedBody);
    if (Array.isArray(parsedPayload)) {
      return parsedPayload.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      );
    }
    if (typeof parsedPayload === 'object' && parsedPayload !== null) {
      return [parsedPayload as Record<string, unknown>];
    }
    return null;
  } catch {
    return null;
  }
}

function classifyDrainRecord(record: Readonly<Record<string, unknown>>): VercelDrainCategory {
  if (
    Array.isArray(record.resourceSpans) ||
    Array.isArray(record.spans) ||
    typeof record.traceId === 'string' ||
    typeof record.spanId === 'string'
  ) {
    return 'traces';
  }

  const metricName =
    typeof record.metric === 'string'
      ? record.metric
      : typeof record.metricType === 'string'
        ? record.metricType
        : '';
  const schemaName = typeof record.schema === 'string' ? record.schema : '';

  if (WEB_VITALS_SET.has(metricName.toUpperCase()) || schemaName.includes('speed_insights')) {
    return 'speed_insights';
  }

  if (
    record.eventType === 'pageview' ||
    record.eventType === 'event' ||
    schemaName.includes('analytics')
  ) {
    return 'web_analytics';
  }

  if (typeof record.source === 'string' && LOG_SOURCE_SET.has(record.source)) {
    return 'logs';
  }

  return 'logs';
}

function isErrorLogRecord(record: Readonly<Record<string, unknown>>): boolean {
  if (record.level === 'error' || record.level === 'fatal') {
    return true;
  }
  if (typeof record.statusCode === 'number' && record.statusCode >= ERROR_STATUS_CODE_THRESHOLD) {
    return true;
  }
  const proxyRecord =
    typeof record.proxy === 'object' && record.proxy !== null
      ? (record.proxy as Record<string, unknown>)
      : null;
  return (
    typeof proxyRecord?.statusCode === 'number' &&
    proxyRecord.statusCode >= ERROR_STATUS_CODE_THRESHOLD
  );
}

function appendDrainBatchSummary(summary: VercelDrainBatchSummary): void {
  recentDrainBatches.unshift(summary);
  if (recentDrainBatches.length > MAX_RECENT_DRAIN_BATCHES) {
    recentDrainBatches.length = MAX_RECENT_DRAIN_BATCHES;
  }
}

export function clearRecentVercelDrainBatchesForTest(): void {
  recentDrainBatches.length = 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-vercel-signature');
  const secret = resolveDrainSecret();
  const verifyHeaders = buildVerifyHeaders(req);

  const isAuthorized = verifyVercelSignature({
    rawBody,
    signatureHeader,
    secret,
  });

  if (!isAuthorized) {
    recordJobExecution('drain.vercel', 0, false);
    logger.warn(
      { hasSignatureHeader: Boolean(signatureHeader) },
      'Rejected Vercel drain delivery with invalid or missing x-vercel-signature'
    );
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid x-vercel-signature' },
      },
      { status: HTTP_STATUS_UNAUTHORIZED, headers: verifyHeaders }
    );
  }

  const contentType = req.headers.get('content-type') ?? 'application/json';
  const records = parseDrainRecords(rawBody, contentType);

  if (records === null) {
    recordJobExecution('drain.vercel', 0, false);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Drain payload must be valid JSON or application/x-ndjson',
        },
      },
      { status: HTTP_STATUS_BAD_REQUEST, headers: verifyHeaders }
    );
  }

  const breakdown: Record<VercelDrainCategory, number> = {
    logs: 0,
    traces: 0,
    speed_insights: 0,
    web_analytics: 0,
  };
  let errorLogCount = 0;

  for (const record of records) {
    const category = classifyDrainRecord(record);
    breakdown[category] += 1;
    if (category === 'logs' && isErrorLogRecord(record)) {
      errorLogCount += 1;
    }
  }

  const summary: VercelDrainBatchSummary = {
    batchId: `drn_${Date.now()}`,
    receivedAtIso: new Date().toISOString(),
    contentType,
    totalRecords: records.length,
    breakdown,
    errorLogCount,
  };

  appendDrainBatchSummary(summary);
  recordJobExecution('drain.vercel', 0, true);

  logger.info(
    {
      batchId: summary.batchId,
      totalRecords: summary.totalRecords,
      breakdown: summary.breakdown,
      errorLogCount: summary.errorLogCount,
    },
    'Ingested verified Vercel Drain telemetry batch'
  );

  return NextResponse.json(
    {
      ok: true,
      summary,
    },
    { status: HTTP_STATUS_OK, headers: verifyHeaders }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const verifyHeaders = buildVerifyHeaders(req);
  const authError = authorizeCronRequest(req);
  if (authError) {
    return new NextResponse(authError.body, {
      status: authError.status,
      headers: {
        ...Object.fromEntries(authError.headers.entries()),
        ...verifyHeaders,
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/drains/vercel',
      supportedFormats: ['application/json', 'application/x-ndjson'],
      supportedLogSources: VERCEL_LOG_DRAIN_SOURCES,
      recentBatchesCount: recentDrainBatches.length,
      recentBatches: recentDrainBatches,
    },
    { status: HTTP_STATUS_OK, headers: verifyHeaders }
  );
}
