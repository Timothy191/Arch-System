/**
 * Real-time data primitives: capped streams, consumer groups, and dead-letter.
 *
 * Streams in this codebase were previously used by exactly one call site with a
 * bare `XADD` + `XREAD`, which is a broadcast log, not a work queue: nothing
 * acknowledged, nothing was ever reclaimed after a crash, and two server
 * instances would each process every entry. This module adds the missing half —
 * groups, acknowledgement, idle-claiming, retry limits and a dead-letter stream
 * — while keeping the broadcast read path available for SSE consumers.
 *
 * Transport note: blocking reads (`BLOCK`) need a persistent socket. On the REST
 * transport the same helpers poll non-blockingly instead, so behaviour is
 * identical at the cost of some latency.
 */

import { incrementCounter } from './analytics';
import { getRedisClient } from './client';
import {
  asNumber,
  asStringArray,
  parseStreamReply,
  type SendCapable,
  type StreamEntry,
  send,
  sendSafe,
  supportsBlockingReads,
} from './raw';

/** A stream plus one of its consumer groups. */
export interface GroupRef {
  key: string;
  group: string;
}

/** A stream, a group, and the named consumer acting on its behalf. */
export interface ConsumerRef extends GroupRef {
  consumer: string;
}

export interface AppendInput {
  key: string;
  fields: Record<string, string>;
  /** Keep at most this many entries (approximate trim by default). */
  maxLen?: number;
  /** Use `~` so Redis trims lazily instead of on every append. */
  approx?: boolean;
  /** Explicit entry id; omit to let Redis generate `ms-sequence`. */
  id?: string;
}

/**
 * Append one entry and return its id, or null when Redis is unreachable.
 * Callers that must not lose telemetry treat null as "degrade, do not throw".
 */
export async function appendToStream(input: AppendInput): Promise<string | null> {
  const redis = await getRedisClient();
  const command: Array<string | number> = ['XADD', input.key];

  if (input.maxLen !== undefined) {
    command.push('MAXLEN', input.approx === false ? '=' : '~', input.maxLen);
  }
  command.push(input.id ?? '*', ...Object.entries(input.fields).flat());

  const reply = await sendSafe(redis, command);
  const id = typeof reply === 'string' ? reply : null;
  if (!id) {
    await incrementCounter('stream.append.failed', { dimension: input.key });
    return null;
  }
  return id;
}

/** Current entry count of a stream (`XLEN`). */
export async function streamLength(key: string): Promise<number> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['XLEN', key]));
}

export interface RangeOptions {
  from?: string;
  to?: string;
  count?: number;
}

/**
 * Read stored entries without consuming them — history hydration for a client
 * that reconnects, or an operator inspecting backlog.
 */
export async function readStream(key: string, options?: RangeOptions): Promise<StreamEntry[]> {
  const redis = await getRedisClient();
  const command: Array<string | number> = ['XRANGE', key, options?.from ?? '-', options?.to ?? '+'];
  if (options?.count !== undefined) command.push('COUNT', options.count);

  const payloads = parseStreamReply(await sendSafe(redis, command));
  return payloads.length === 1 ? (payloads[0]?.entries ?? []) : payloads.flatMap((p) => p.entries);
}

export interface ReadNewOptions {
  /** Stream id to continue after; `$` means only entries newer than now. */
  from?: string;
  count?: number;
  blockMs?: number;
  /**
   * Dedicated connection for long-lived readers. A blocking XREAD occupies its
   * socket until it returns, so an SSE loop must not share the request client.
   */
  client?: SendCapable;
}

/**
 * Read entries produced after `from` across one or more streams (SSE style).
 * Non-consuming: peers each see every entry. Use a consumer group when work must
 * be split rather than broadcast.
 */
export async function readNew(
  streams: string[] | string,
  options?: ReadNewOptions
): Promise<{ key: string; entries: StreamEntry[] }[]> {
  const keys = Array.isArray(streams) ? streams : [streams];
  const redis = options?.client ?? (await getRedisClient());
  const command: Array<string | number> = ['XREAD'];

  if (options?.blockMs !== undefined && supportsBlockingReads()) {
    command.push('BLOCK', options.blockMs);
  }
  if (options?.count !== undefined) command.push('COUNT', options.count);
  command.push('STREAMS', ...keys, ...keys.map(() => options?.from ?? '$'));

  return parseStreamReply(await sendSafe(redis, command));
}

export interface CreateGroupInput extends GroupRef {
  /** Where the group starts: `0` for the whole stream, `$` for new entries. */
  from?: string;
}

/**
 * Create a consumer group over the whole stream, tolerating the group already
 * existing. Returns true when this call created it.
 */
export async function ensureConsumerGroup(input: CreateGroupInput): Promise<boolean> {
  const redis = await getRedisClient();
  try {
    // MKSTREAM creates the stream when the first consumer starts before producers.
    await send(redis, ['XGROUP', 'CREATE', input.key, input.group, input.from ?? '0', 'MKSTREAM']);
    await incrementCounter('stream.group.created', { dimension: input.key });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('BUSYGROUP')) return false;
    throw error;
  }
}

/** Remove a consumer group (used when a group name is retired). */
export async function destroyConsumerGroup(key: string, group: string): Promise<boolean> {
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['XGROUP', 'DESTROY', key, group])) === 1;
}

export interface ReadGroupInput extends ConsumerRef {
  count?: number;
  blockMs?: number;
  /** Skip acknowledgement (fire-and-forget consumers). */
  noAck?: boolean;
}

/**
 * Claim the next batch of entries for this consumer. Unacknowledged entries stay
 * in the group's pending list and can be claimed by anyone after `idleMs`.
 */
export async function readFromGroup(input: ReadGroupInput): Promise<StreamEntry[]> {
  const redis = await getRedisClient();
  const command: Array<string | number> = ['XREADGROUP', 'GROUP', input.group, input.consumer];

  if (input.count !== undefined) command.push('COUNT', input.count);
  if (input.blockMs !== undefined && supportsBlockingReads()) {
    command.push('BLOCK', input.blockMs);
  }
  if (input.noAck) command.push('NOACK');
  command.push('STREAMS', input.key, '>');

  const payloads = parseStreamReply(await sendSafe(redis, command));
  return payloads.flatMap((payload) => payload.entries);
}

export interface AckInput extends GroupRef {
  ids: string[];
}

/** Acknowledge entries so Redis can drop them from the pending list. */
export async function acknowledge(input: AckInput): Promise<number> {
  if (input.ids.length === 0) return 0;
  const redis = await getRedisClient();
  return asNumber(await sendSafe(redis, ['XACK', input.key, input.group, ...input.ids]));
}

export interface PendingEntry {
  id: string;
  consumer: string;
  idleMs: number;
  deliveries: number;
}

function parsePendingRows(reply: unknown): PendingEntry[] {
  if (!Array.isArray(reply)) return [];
  return reply
    .map((row): PendingEntry | null => {
      if (Array.isArray(row)) {
        const [id, consumer, , deliveries] = row as [unknown, unknown, unknown, unknown];
        const text = typeof id === 'string' ? id : null;
        if (!text) return null;
        return {
          id: text,
          consumer: typeof consumer === 'string' ? consumer : '',
          idleMs: 0,
          deliveries: asNumber(deliveries),
        };
      }
      if (row && typeof row === 'object') {
        const candidate = row as {
          messageID?: unknown;
          consumer?: unknown;
          deliveryCount?: unknown;
          time?: unknown;
        };
        const id = typeof candidate.messageID === 'string' ? candidate.messageID : null;
        if (!id) return null;
        return {
          id,
          consumer: String(candidate.consumer ?? ''),
          idleMs: asNumber(candidate.time),
          deliveries: asNumber(candidate.deliveryCount),
        };
      }
      return null;
    })
    .filter((entry): entry is PendingEntry => entry !== null);
}

const DEFAULT_PENDING_SCAN = 100;
const DEAD_LETTER_MAX_LEN = 1_000;
const MAX_ERROR_BACKOFF_MS = 10_000;

export interface ReadPendingInput extends GroupRef {
  start?: string;
  end?: string;
  count?: number;
}

/** Entries assigned to the group but never acknowledged. */
export async function readPending(input: ReadPendingInput): Promise<PendingEntry[]> {
  const redis = await getRedisClient();
  const reply = await sendSafe(redis, [
    'XPENDING',
    input.key,
    input.group,
    input.start ?? '-',
    input.end ?? '+',
    input.count ?? DEFAULT_PENDING_SCAN,
  ]);
  return parsePendingRows(reply);
}

export interface AutoClaimResult {
  nextCursor: string;
  entries: StreamEntry[];
  deleted: string[];
}

/**
 * XAUTOCLAIM reply, which is unfortunately shaped twice: RESP2 nests the cursor
 * with the entries (`[[cursor, entries], deleted]`) and node-redis transforms it
 * into `{ nextId, messages, deletedMessages }`.
 */
function parseAutoClaim(reply: unknown): AutoClaimResult {
  if (!reply) return { nextCursor: '0-0', entries: [], deleted: [] };

  if (!Array.isArray(reply) && typeof reply === 'object') {
    const candidate = reply as { nextId?: unknown; messages?: unknown; deletedMessages?: unknown };
    return {
      nextCursor: typeof candidate.nextId === 'string' ? candidate.nextId : '0-0',
      entries: parseStreamEntries(candidate.messages),
      deleted: asStringArray(candidate.deletedMessages),
    };
  }

  if (!Array.isArray(reply)) return { nextCursor: '0-0', entries: [], deleted: [] };

  const head = reply[0];
  const tail = reply[reply.length - 1];

  if (Array.isArray(head)) {
    const [cursor, entriesRaw] = head as [unknown, unknown];
    return {
      nextCursor: typeof cursor === 'string' ? cursor : '0-0',
      entries: parseStreamEntries(entriesRaw),
      deleted: asStringArray(tail),
    };
  }

  return {
    nextCursor: typeof head === 'string' ? head : '0-0',
    entries: parseStreamEntries(reply[1]),
    deleted: asStringArray(Array.isArray(reply[2]) ? reply[2] : null),
  };
}

function parseStreamEntries(raw: unknown): StreamEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): StreamEntry | null => {
      if (Array.isArray(item)) {
        const [id, fieldPairs] = item as [unknown, unknown];
        if (typeof id !== 'string') return null;
        const fields: Record<string, string> = {};
        if (Array.isArray(fieldPairs)) {
          for (let i = 0; i + 1 < fieldPairs.length; i += 2) {
            fields[String(fieldPairs[i])] = String(fieldPairs[i + 1]);
          }
        }
        return { id, fields };
      }
      if (item && typeof item === 'object') {
        const candidate = item as { id?: unknown; message?: unknown };
        if (typeof candidate.id !== 'string') return null;
        const fields: Record<string, string> = {};
        if (candidate.message && typeof candidate.message === 'object') {
          for (const [field, value] of Object.entries(
            candidate.message as Record<string, unknown>
          )) {
            fields[field] = String(value);
          }
        }
        return { id: candidate.id, fields };
      }
      return null;
    })
    .filter((entry): entry is StreamEntry => entry !== null);
}

export interface ClaimInput extends ConsumerRef {
  idleMs: number;
  count?: number;
  cursor?: string;
}

/**
 * Take over entries abandoned by a consumer that died or stalled. This is what
 * makes a stream queue survivable: without it, a crashed worker's unacked
 * entries are never seen again.
 */
export async function claimIdle(input: ClaimInput): Promise<AutoClaimResult> {
  const redis = await getRedisClient();
  const command: Array<string | number> = [
    'XAUTOCLAIM',
    input.key,
    input.group,
    input.consumer,
    Math.max(0, input.idleMs),
    input.cursor ?? '0-0',
  ];
  if (input.count !== undefined) command.push('COUNT', input.count);

  return parseAutoClaim(await sendSafe(redis, command));
}

export interface DeadLetterInput extends GroupRef {
  entry: StreamEntry;
  /** Defaults to `<stream>:dead`. */
  destination?: string;
  maxLen?: number;
  reason?: string;
}

/**
 * Move an entry out of the working stream after repeated failures, so one
 * poisonous message cannot stall the consumer forever, and acknowledge the
 * original so the pending list shrinks.
 */
export async function moveToDeadLetter(input: DeadLetterInput): Promise<string | null> {
  const destination = input.destination ?? `${input.key}:dead`;
  const id = await appendToStream({
    key: destination,
    fields: {
      ...input.entry.fields,
      _source: input.key,
      _sourceId: input.entry.id,
      ...(input.reason ? { _reason: input.reason } : {}),
    },
    maxLen: input.maxLen ?? DEAD_LETTER_MAX_LEN,
  });

  if (id) {
    await acknowledge({ key: input.key, group: input.group, ids: [input.entry.id] });
    await incrementCounter('stream.deadlettered', { dimension: input.key });
  }
  return id;
}

export interface ConsumeInput extends ConsumerRef {
  /** How many entries to pull per read. */
  count?: number;
  /** Longest a handler may take before its entries look abandoned. */
  idleMs?: number;
  /** Delivery attempts before the entry is dead-lettered. */
  maxDeliveries?: number;
  /** Pause between non-blocking reads (REST transport only). */
  pollMs?: number;
  /** Backoff after a handler or transport error. */
  errorBackoffMs?: number;
  /** Bound so an operator can stop a loop without killing the process. */
  maxIterations?: number;
}

/**
 * Drive a consumer group: read new work, reclaim idle work, acknowledge on
 * success, dead-letter after `maxDeliveries`.
 *
 * The handler decides what a failure is by throwing; the loop never loses an
 * entry silently, and never reprocesses an acknowledged one.
 */
export async function consumeStream(
  input: ConsumeInput,
  handler: (entry: StreamEntry) => Promise<void>
): Promise<{ processed: number; failed: number; dead: number }> {
  const { key, group, consumer } = input;
  const {
    count = 10,
    idleMs = 60_000,
    maxDeliveries = 3,
    pollMs = 500,
    errorBackoffMs = 1_000,
    maxIterations = 1,
  } = input;

  let processed = 0;
  let failed = 0;
  let dead = 0;

  await ensureConsumerGroup({ key, group });

  const pendingDeliveries = new Map<string, number>();
  for (const row of await readPending({ key, group })) {
    pendingDeliveries.set(row.id, row.deliveries);
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const batch: StreamEntry[] = [];

    try {
      const reclaimed = await claimIdle({ key, group, consumer, idleMs, count });
      batch.push(...reclaimed.entries);
      for (const id of reclaimed.deleted) pendingDeliveries.delete(id);

      batch.push(...(await readFromGroup({ key, group, consumer, count })));
    } catch {
      await incrementCounter('stream.read.failed', { dimension: key });
      await sleep(Math.min(errorBackoffMs * (iteration + 1), MAX_ERROR_BACKOFF_MS));
      continue;
    }

    for (const entry of batch) {
      const deliveries = pendingDeliveries.get(entry.id) ?? 1;
      pendingDeliveries.set(entry.id, deliveries);

      if (deliveries > maxDeliveries) {
        const moved = await moveToDeadLetter({
          key,
          group,
          entry,
          reason: `exceeded ${maxDeliveries} deliveries`,
        });
        if (moved) dead++;
        pendingDeliveries.delete(entry.id);
        continue;
      }

      try {
        await handler(entry);
        await acknowledge({ key, group, ids: [entry.id] });
        pendingDeliveries.delete(entry.id);
        processed++;
      } catch {
        failed++;
        await incrementCounter('stream.handler.failed', { dimension: key });
      }
    }

    if (batch.length === 0 && !supportsBlockingReads()) {
      await sleep(pollMs);
    }
  }

  return { processed, failed, dead };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
}

/**
 * Trailing entries as plain objects, for dashboards and replay endpoints that
 * want parsed JSON rather than stream field maps.
 */
export async function readStreamJson<T = Record<string, unknown>>(
  key: string,
  options?: RangeOptions & { field?: string }
): Promise<{ id: string; value: T }[]> {
  const field = options?.field ?? 'data';
  const entries = await readStream(key, options);

  return entries.flatMap((entry) => {
    const raw = entry.fields[field] ?? JSON.stringify(entry.fields);
    try {
      return [{ id: entry.id, value: JSON.parse(raw) as T }];
    } catch {
      return [];
    }
  });
}
