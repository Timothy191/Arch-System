import {
  abandonIdempotency,
  claimIdempotency,
  completeIdempotency,
  type IdempotencyClaim,
  readIdempotencyResult,
} from '@repo/redis';
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

/**
 * Offline-replay endpoint. The browser queue (`useOfflineQueue`) posts queued
 * mutations here once connectivity returns; each carries its queue id as
 * `x-idempotency-key`.
 *
 * Two guarantees this route did not previously have:
 *  - **Replay safety.** A retried queue item used to re-execute the action, so a
 *    dropped response after a successful write produced a duplicate dozer roll,
 *    delay entry or daily log. The claim is taken before any side effect and
 *    only completed on success, so a failure stays retryable.
 *  - **Backpressure.** It is an unauthenticated-write surface as far as the
 *    network is concerned; a flooding client used to reach Postgres directly.
 *
 * The per-action handlers still authenticate and authorize the payload — this
 * route adds no permissions of its own.
 */

const REPLAY_LIMIT = { windowMs: 60_000, maxRequests: 30 };
const CLAIM_TTL_SECONDS = 86_400;

interface ReplayResult {
  success: boolean;
  error?: { message: string; code: string };
}

/**
 * Queued payloads are validated by the action that consumes them; this route
 * only transports them, so each case narrows to that action's own input type.
 */
type Input<T extends (...args: never[]) => unknown> = Parameters<T>[0];

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { message, code: 'VALIDATION' } },
    { status: 400 }
  );
}

async function dispatch(action: string, payload: unknown): Promise<ReplayResult> {
  switch (action) {
    case 'createDozerRoll': {
      const { createDozerRoll } = await import('@repo/departments/ui/server');
      await createDozerRoll(payload as Input<typeof createDozerRoll>);
      return { success: true };
    }
    case 'saveDelayEntriesBatch': {
      const { saveDelayEntriesBatch } = await import(
        '@/app/(departments)/[department]/machine-operations/actions'
      );
      await saveDelayEntriesBatch(payload as Input<typeof saveDelayEntriesBatch>);
      return { success: true };
    }
    case 'createEngineeringNote': {
      const { createEngineeringNote } = await import(
        '@/app/(departments)/[department]/engineering-notes/actions'
      );
      await createEngineeringNote(payload as Input<typeof createEngineeringNote>);
      return { success: true };
    }
    case 'createDailyLog': {
      const { createDailyLog } = await import('@/app/(departments)/[department]/daily-log/actions');
      await createDailyLog(payload as Input<typeof createDailyLog>);
      return { success: true };
    }
    case 'createDepartment': {
      const { createDepartment } = await import('@/features/admin/tabs/actions');
      await createDepartment(payload as Input<typeof createDepartment>);
      return { success: true };
    }
    default:
      return {
        success: false,
        error: { message: 'Unknown action', code: 'API_ERROR' },
      };
  }
}

/** Longer than any client-generated queue id; guards against header abuse. */
const MAX_QUEUE_ID_LENGTH = 200;
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;

async function replay(req: NextRequest): Promise<NextResponse> {
  const queueId = req.headers.get('x-idempotency-key');
  if (!queueId || queueId.length > MAX_QUEUE_ID_LENGTH) {
    return badRequest('Missing or malformed x-idempotency-key');
  }

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    payload?: unknown;
  } | null;

  if (!body || typeof body.action !== 'string') {
    return badRequest('Unknown action');
  }

  const claimKey = `${body.action}:${queueId}`;

  let claim: IdempotencyClaim | 'unavailable' = 'new';
  try {
    claim = await claimIdempotency(claimKey, { ttlSeconds: CLAIM_TTL_SECONDS });
  } catch {
    // Deduplication is an improvement, not a dependency: without Redis the
    // replay still runs, exactly as it did before.
    claim = 'unavailable';
  }

  if (claim === 'duplicate') {
    const prior = await readIdempotencyResult<ReplayResult>(claimKey).catch(() => null);
    return NextResponse.json(prior ?? { success: true }, { status: 200 });
  }
  if (claim === 'in-flight') {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'This replay is already running', code: 'CONFLICT' },
      },
      { status: 409 }
    );
  }

  let result: ReplayResult;
  try {
    result = await dispatch(body.action, body.payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (claim === 'new') await abandonIdempotency(claimKey).catch(() => undefined);
    return NextResponse.json(
      { success: false, error: { message, code: 'API_ERROR' } },
      { status: 500 }
    );
  }

  if (claim === 'new') {
    // Only a replay that did its job is remembered; a rejection or throw must
    // stay retryable, otherwise the operator's queued entry is lost.
    await (result.success
      ? completeIdempotency({
          key: claimKey,
          result,
          ttlSeconds: CLAIM_TTL_SECONDS,
        })
      : abandonIdempotency(claimKey)
    ).catch(() => undefined);
  }

  return NextResponse.json(result, {
    status: result.success ? HTTP_OK : HTTP_BAD_REQUEST,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withRateLimit(req, () => replay(req), { customLimit: REPLAY_LIMIT });
}
