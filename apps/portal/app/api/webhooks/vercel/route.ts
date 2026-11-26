import { createLogger } from '@repo/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withBodyLimit } from '@/lib/api/body-limit';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { verifyVercelSignature } from '@/lib/api/vercel-signature';
import { dispatchIntegrationEventTriggers } from '@/lib/integrations/tool-bridge';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

const logger = createLogger('portal:vercel-webhooks');

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const MAX_RECENT_WEBHOOK_EVENTS = 50;
const MAX_VERCEL_WEBHOOK_BODY_BYTES = 524_288;

export const VERCEL_WEBHOOK_EVENT_TYPES = [
  // Deployment Events
  'deployment.created',
  'deployment.succeeded',
  'deployment.promoted',
  'deployment.rollback',
  'deployment.error',
  'deployment.canceled',
  'deployment.cancelled',
  // Project Events
  'project.created',
  'project.removed',
  'project.renamed',
  'project.env-variable.created',
  'project.env-variable.updated',
  'project.env-variable.deleted',
  // Feature Flag Events
  'flags.flag.created',
  'flags.flag.updated',
  'flags.flag.deleted',
  'flags.segment.created',
  'flags.segment.updated',
  'flags.segment.deleted',
  // Firewall Events
  'firewall.attack',
] as const;

export type VercelWebhookEventType = (typeof VERCEL_WEBHOOK_EVENT_TYPES)[number];
export type VercelWebhookCategory = 'deployment' | 'project' | 'flags' | 'firewall';

export const VERCEL_WEBHOOK_CATEGORY_BY_EVENT: Readonly<
  Record<VercelWebhookEventType, VercelWebhookCategory>
> = {
  'deployment.created': 'deployment',
  'deployment.succeeded': 'deployment',
  'deployment.promoted': 'deployment',
  'deployment.rollback': 'deployment',
  'deployment.error': 'deployment',
  'deployment.canceled': 'deployment',
  'deployment.cancelled': 'deployment',
  'project.created': 'project',
  'project.removed': 'project',
  'project.renamed': 'project',
  'project.env-variable.created': 'project',
  'project.env-variable.updated': 'project',
  'project.env-variable.deleted': 'project',
  'flags.flag.created': 'flags',
  'flags.flag.updated': 'flags',
  'flags.flag.deleted': 'flags',
  'flags.segment.created': 'flags',
  'flags.segment.updated': 'flags',
  'flags.segment.deleted': 'flags',
  'firewall.attack': 'firewall',
};

const VercelWebhookEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(VERCEL_WEBHOOK_EVENT_TYPES),
  createdAt: z.number().int().nonnegative(),
  region: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export interface ProcessedVercelWebhookRecord {
  readonly id: string;
  readonly type: VercelWebhookEventType;
  readonly category: VercelWebhookCategory;
  readonly createdAt: number;
  readonly receivedAtIso: string;
  readonly region: string | null;
  readonly targetName: string | null;
  readonly targetUrl: string | null;
  readonly actionTaken: string;
}

const recentWebhookEvents: ProcessedVercelWebhookRecord[] = [];

import { getRedisClient } from '@repo/redis';

const VERCEL_WEBHOOKS_REDIS_KEY = 'arch:telemetry:vercel_webhooks';
const _skipRedisForTest = false;

const ACTION_DESCRIPTION_BY_CATEGORY: Readonly<Record<VercelWebhookCategory, string>> = {
  deployment: 'Recorded deployment lifecycle webhook event in Redis telemetry log',
  project: 'Recorded project configuration/environment webhook event in Redis telemetry log',
  flags: 'Recorded feature-flag / segment webhook event in Redis telemetry log',
  firewall: 'Recorded Vercel Firewall alert webhook event in Redis telemetry log',
};

function resolveWebhookSecret(): string | undefined {
  return process.env.VERCEL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
}

function extractTargetMetadata(payload: Readonly<Record<string, unknown>>): {
  readonly targetName: string | null;
  readonly targetUrl: string | null;
} {
  const deploymentRecord =
    typeof payload.deployment === 'object' && payload.deployment !== null
      ? (payload.deployment as Record<string, unknown>)
      : null;
  const projectRecord =
    typeof payload.project === 'object' && payload.project !== null
      ? (payload.project as Record<string, unknown>)
      : null;

  const targetName =
    (typeof deploymentRecord?.name === 'string' ? deploymentRecord.name : null) ??
    (typeof projectRecord?.name === 'string' ? projectRecord.name : null) ??
    (typeof payload.name === 'string' ? payload.name : null);

  const targetUrl =
    (typeof deploymentRecord?.url === 'string' ? deploymentRecord.url : null) ??
    (typeof payload.url === 'string' ? payload.url : null);

  return { targetName, targetUrl };
}

async function appendRecentWebhookRecord(record: ProcessedVercelWebhookRecord): Promise<void> {
  recentWebhookEvents.unshift(record);
  if (recentWebhookEvents.length > MAX_RECENT_WEBHOOK_EVENTS) {
    recentWebhookEvents.length = MAX_RECENT_WEBHOOK_EVENTS;
  }
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      await redis.lPush(VERCEL_WEBHOOKS_REDIS_KEY, JSON.stringify(record));
      await redis.lTrim(VERCEL_WEBHOOKS_REDIS_KEY, 0, MAX_RECENT_WEBHOOK_EVENTS - 1);
    }
  } catch {
    // Keep in-memory buffer when Redis is unavailable
  }
}

async function readRecentWebhookRecords(): Promise<ProcessedVercelWebhookRecord[]> {
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      const rawItems = await redis.lRange(
        VERCEL_WEBHOOKS_REDIS_KEY,
        0,
        MAX_RECENT_WEBHOOK_EVENTS - 1
      );
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems
          .map((item) => {
            try {
              return JSON.parse(item) as ProcessedVercelWebhookRecord;
            } catch {
              return null;
            }
          })
          .filter((item): item is ProcessedVercelWebhookRecord => item !== null);
      }
    }
  } catch {
    // Fall back to in-memory buffer
  }
  return recentWebhookEvents;
}

export function clearRecentVercelWebhookEventsForTest(): void {
  recentWebhookEvents.length = 0;
}

async function handleVercelPost(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-vercel-signature');
  const secret = resolveWebhookSecret();

  const isAuthorized = verifyVercelSignature({
    rawBody,
    signatureHeader,
    secret,
  });

  if (!isAuthorized) {
    recordJobExecution('webhook.vercel', 0, false);
    logger.warn(
      { hasSignatureHeader: Boolean(signatureHeader) },
      'Rejected Vercel webhook with invalid or missing x-vercel-signature'
    );
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid x-vercel-signature' },
      },
      { status: HTTP_STATUS_UNAUTHORIZED }
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch (parseError) {
    recordJobExecution('webhook.vercel', 0, false);
    logger.warn({ err: parseError }, 'Malformed JSON body in Vercel webhook request');
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      },
      { status: HTTP_STATUS_BAD_REQUEST }
    );
  }

  const validation = VercelWebhookEnvelopeSchema.safeParse(parsedJson);
  if (!validation.success) {
    recordJobExecution('webhook.vercel', 0, false);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues.map((issue) => issue.message).join('; '),
        },
      },
      { status: HTTP_STATUS_BAD_REQUEST }
    );
  }

  const envelope = validation.data;
  const category = VERCEL_WEBHOOK_CATEGORY_BY_EVENT[envelope.type];
  const { targetName, targetUrl } = extractTargetMetadata(envelope.payload);
  const actionTaken = ACTION_DESCRIPTION_BY_CATEGORY[category];

  const processedRecord: ProcessedVercelWebhookRecord = {
    id: envelope.id,
    type: envelope.type,
    category,
    createdAt: envelope.createdAt,
    receivedAtIso: new Date().toISOString(),
    region: envelope.region ?? null,
    targetName,
    targetUrl,
    actionTaken,
  };

  await appendRecentWebhookRecord(processedRecord);
  recordJobExecution(`webhook.vercel.${category}`, 0, true);

  const triggeredIntegrations = await dispatchIntegrationEventTriggers({
    eventName: `vercel.${envelope.type}`,
  });

  logger.info(
    {
      webhookId: processedRecord.id,
      eventType: processedRecord.type,
      category: processedRecord.category,
      region: processedRecord.region,
      targetName: processedRecord.targetName,
      triggeredIntegrationsCount: triggeredIntegrations.length,
    },
    'Processed verified Vercel webhook event'
  );

  return NextResponse.json(
    {
      ok: true,
      event: processedRecord,
      triggeredIntegrations,
    },
    { status: HTTP_STATUS_OK }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withRateLimit(req, () =>
    withBodyLimit(req, () => handleVercelPost(req), { maxSize: MAX_VERCEL_WEBHOOK_BODY_BYTES })
  );
}

async function handleVercelGet(req: NextRequest): Promise<NextResponse> {
  const authError = authorizeCronRequest(req);
  if (authError) {
    return authError;
  }

  const events = await readRecentWebhookRecords();

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/webhooks/vercel',
      signatureHeader: 'x-vercel-signature',
      algorithm: 'HMAC-SHA1',
      supportedEvents: VERCEL_WEBHOOK_EVENT_TYPES,
      recentEventsCount: events.length,
      recentEvents: events,
    },
    { status: HTTP_STATUS_OK }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withRateLimit(req, () => handleVercelGet(req));
}
