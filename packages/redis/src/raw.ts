/**
 * Transport-agnostic command layer.
 *
 * Every capability in this package issues commands through `send()` instead of
 * calling node-redis methods directly, because the monorepo runs against two
 * very different transports: a TCP connection (Vercel self-hosted, local dev,
 * CI) and an Upstash-compatible HTTP REST adapter (serverless deploys). The TCP
 * client returns transformed objects; the REST adapter returns raw RESP arrays.
 * Normalizing once here means the lock/stream/analytics/search modules behave
 * identically on both, instead of silently degrading on one of them.
 */

import { getRedisClient, isServerlessRedis } from './client';

/** `Buffer` rather than `Uint8Array`: that is what node-redis' raw surface takes. */
export type RedisCommandArg = string | number | Buffer;

export type RedisCommand = RedisCommandArg[];

export type RedisTransport = 'tcp' | 'serverless-rest';

/** Thrown when Redis cannot be reached or rejects a command. */
export class RedisCommandError extends Error {
  readonly command: string;

  constructor(command: string, options?: { message?: string; cause?: unknown }) {
    super(options?.message ?? `Redis command "${command}" failed`, { cause: options?.cause });
    this.name = 'RedisCommandError';
    this.command = command;
  }
}

export type SendCapable = {
  sendCommand?: (args: Array<string | Buffer>) => Promise<unknown>;
  command?: unknown;
};

/**
 * Numbers become strings; binary arguments (RediSearch vectors) pass through so
 * the transport sends them as opaque bytes instead of utf8-mangling them.
 */
function stringify(args: RedisCommand): Array<string | Buffer> {
  return args.map((arg) => (typeof arg === 'number' ? String(arg) : arg));
}

/**
 * Send one command on any transport. Throws RedisCommandError when neither
 * transport exposes a raw command surface (defensive: a future client swap).
 */
export async function send(client: SendCapable, command: RedisCommand): Promise<unknown> {
  const args = stringify(command);
  const raw = client as {
    sendCommand?: (args: Array<string | Buffer>) => Promise<unknown>;
    command?: (command: string, args?: Array<string | Buffer>) => Promise<unknown>;
  };
  try {
    if (typeof raw.sendCommand === 'function') {
      return await raw.sendCommand(args);
    }
    if (typeof raw.command === 'function') {
      return await raw.command(args[0] as string, args.slice(1));
    }
  } catch (error) {
    const name = String(args[0]);
    throw new RedisCommandError(name, {
      message: `Redis command "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      cause: error,
    });
  }
  const name = String(args[0]);
  throw new RedisCommandError(name, {
    message: `Redis transport does not support raw commands (${name})`,
  });
}

/**
 * Send a command, returning null instead of throwing. Used by best-effort
 * paths (health probes, counters) that must never break a request.
 */
export async function sendSafe(
  client: SendCapable,
  command: RedisCommand
): Promise<unknown | null> {
  try {
    return await send(client, command);
  } catch {
    return null;
  }
}

export function currentTransport(): RedisTransport {
  return isServerlessRedis() ? 'serverless-rest' : 'tcp';
}

/** True when blocking reads (XREAD BLOCK / BZPOP) can be used on this transport. */
export function supportsBlockingReads(): boolean {
  return currentTransport() === 'tcp';
}

/** Redis returns simple status replies such as `+OK`. */
export function isOkReply(reply: unknown): boolean {
  return reply === 'OK' || reply === 1 || reply === true;
}

/** Integer replies arrive as number (TCP), string (REST) or bigint. */
export function asNumber(reply: unknown, fallback = 0): number {
  if (typeof reply === 'number') return Number.isFinite(reply) ? reply : fallback;
  if (typeof reply === 'bigint') return Number(reply);
  if (typeof reply === 'string') {
    const parsed = Number(reply);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function asStringOrNull(reply: unknown): string | null {
  if (reply === null || reply === undefined) return null;
  if (typeof reply === 'string') return reply;
  if (typeof reply === 'number' || typeof reply === 'bigint') return String(reply);
  return null;
}

export function asStringArray(reply: unknown): string[] {
  if (!Array.isArray(reply)) return [];
  return reply.map((item) => asStringOrNull(item)).filter((item): item is string => item !== null);
}

/**
 * HGETALL reply -> field map. TCP may hand back an object, REST a flat array.
 */
export function asFieldMap(reply: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (Array.isArray(reply)) {
    for (let i = 0; i + 1 < reply.length; i += 2) {
      const field = asStringOrNull(reply[i]);
      const value = asStringOrNull(reply[i + 1]);
      if (field !== null && value !== null) result[field] = value;
    }
    return result;
  }
  if (reply && typeof reply === 'object') {
    for (const [field, value] of Object.entries(reply as Record<string, unknown>)) {
      const text = asStringOrNull(value);
      if (text !== null) result[field] = text;
    }
  }
  return result;
}

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface StreamPayload {
  key: string;
  entries: StreamEntry[];
}

/**
 * `[id, [field, value, field, value]]` -> `{ id, fields }`, also tolerating the
 * already-transformed `{ id, message }` shape node-redis returns for typed calls.
 */
function parseStreamEntry(raw: unknown): StreamEntry | null {
  if (Array.isArray(raw)) {
    const id = asStringOrNull(raw[0]);
    if (!id) return null;
    return { id, fields: asFieldMap(raw[1]) };
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as { id?: unknown; message?: unknown; fields?: unknown };
    const id = asStringOrNull(candidate.id);
    if (!id) return null;
    return { id, fields: asFieldMap(candidate.message ?? candidate.fields) };
  }
  return null;
}

/**
 * XRANGE / XREAD / XREADGROUP reply -> per-stream entry lists.
 *
 * RESP2 shape: `[[stream, [[id, [f, v]]]], ...]` for reads, or a bare
 * `[[id, [f, v]]]` for XRANGE. Both are handled because they come from
 * different commands against the same parser.
 */
export function parseStreamReply(raw: unknown): StreamPayload[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];

  // XREAD/XREADGROUP: array of [streamName, entries] pairs.
  const shaped = raw
    .map((item): StreamPayload | null => {
      if (!Array.isArray(item)) return null;
      const key = asStringOrNull(item[0]);
      if (!key) return null;
      const entriesRaw = item[1];
      if (!Array.isArray(entriesRaw)) return null;
      // XPENDING-EXTENDED style rows are `[id, consumer, ts, count]` — reject.
      const isStream = entriesRaw.every((entry) => Array.isArray(entry) && Array.isArray(entry[1]));
      if (!isStream) return null;
      const entries = entriesRaw
        .map(parseStreamEntry)
        .filter((entry): entry is StreamEntry => entry !== null);
      return { key, entries };
    })
    .filter((payload): payload is StreamPayload => payload !== null);
  if (shaped.length > 0) return shaped;

  // XRANGE: bare list of entries against a key the caller already knows.
  const entries = raw.map(parseStreamEntry).filter((e): e is StreamEntry => e !== null);
  return entries.length > 0 ? [{ key: '', entries }] : [];
}

export interface ScoredMember {
  member: string;
  score: number;
}

/** ZRANGE/ZREVRANGE ... WITHSCORES -> `{ member, score }` list. */
export function asScoredMembers(reply: unknown): ScoredMember[] {
  if (!Array.isArray(reply)) return [];

  // Typed node-redis shape: [{ value, score }]
  const typed = reply
    .map((item): ScoredMember | null => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const candidate = item as { value?: unknown; member?: unknown; score?: unknown };
        const member = asStringOrNull(candidate.value ?? candidate.member);
        if (member === null) return null;
        return { member, score: asNumber(candidate.score) };
      }
      return null;
    })
    .filter((item): item is ScoredMember => item !== null);
  if (typed.length > 0) return typed;

  const members: ScoredMember[] = [];
  for (let i = 0; i + 1 < reply.length; i += 2) {
    const member = asStringOrNull(reply[i]);
    if (member === null) continue;
    members.push({ member, score: asNumber(reply[i + 1]) });
  }
  return members;
}

/** Nested `{ key: value }` lines from INFO -> flat record. */
export function asInfoMap(reply: unknown): Record<string, string> {
  const text = asStringOrNull(reply);
  if (!text) return {};
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    result[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  return result;
}

export interface RedisCapabilities {
  transport: RedisTransport;
  /** Lua scripting (EVAL) — required for atomic lock release and counters. */
  eval: boolean;
  streams: boolean;
  hyperLogLog: boolean;
  sortedSets: boolean;
  /** RediSearch / Redis Query Engine: vector similarity search is available. */
  search: boolean;
  /** Blocking reads need a persistent socket; REST cannot park a request. */
  blocking: boolean;
  redisVersion?: string;
  probedAt: number;
}

/** Five minutes: long enough to amortise the probe, short enough to notice a module load. */
const CAPABILITY_TTL_MS = 300_000;
let cachedCapabilities: RedisCapabilities | null = null;

/** Test hook: force the next caller to re-probe. */
export function resetCapabilityCache(): void {
  cachedCapabilities = null;
}

function commandExistsFlags(reply: unknown, names: readonly string[]): Map<string, boolean> {
  const rows = Array.isArray(reply) ? reply : [];
  return new Map(
    names.map((name, index) => [name, asNumber(rows[index] ?? 1) === 1] as [string, boolean])
  );
}

function searchModulePresent(reply: unknown): boolean {
  const names = new Set<string>();
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const nested of item) visit(nested);
      return;
    }
    if (typeof item === 'string') names.add(item.toLowerCase());
  };
  visit(reply);
  // Redis Stack reports the query engine as `search`; Redis 8 folds it into `query`.
  return names.has('search') || names.has('query');
}

/**
 * Probe the server once per TTL window: which command families exist and
 * whether the RediSearch module is loaded. Callers use this to choose between
 * the Redis path and a Postgres/pgvector fallback instead of throwing.
 */
export async function detectCapabilities(
  client?: SendCapable,
  options?: { force?: boolean }
): Promise<RedisCapabilities> {
  if (cachedCapabilities && !options?.force) {
    if (Date.now() - cachedCapabilities.probedAt < CAPABILITY_TTL_MS) return cachedCapabilities;
  }

  const redis = client ?? (await getRedisClient());
  const transport = currentTransport();
  const probedAt = Date.now();

  const probeCommands = ['EVAL', 'XADD', 'PFADD', 'ZADD', 'GETEX'] as const;
  const [probe, modules, info] = await Promise.all([
    sendSafe(redis, ['COMMAND', 'EXISTS', ...probeCommands]),
    sendSafe(redis, ['MODULE', 'LIST']).catch(() => null),
    sendSafe(redis, ['INFO', 'server']).catch(() => null),
  ]);

  const flags = commandExistsFlags(probe, probeCommands);
  const has = (name: string): boolean => flags.get(name) ?? true;
  const version = asInfoMap(info).redis_version;

  cachedCapabilities = {
    transport,
    // REST transports may not implement COMMAND; assume the family is available
    // and let the first real call prove it rather than disabling it up front.
    eval: has('EVAL'),
    streams: has('XADD'),
    hyperLogLog: has('PFADD'),
    sortedSets: has('ZADD'),
    search: searchModulePresent(modules),
    blocking: transport === 'tcp',
    ...(version ? { redisVersion: version } : {}),
    probedAt,
  };

  return cachedCapabilities;
}
