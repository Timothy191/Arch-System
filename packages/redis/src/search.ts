import { getRedisClient } from './client';
import {
  asFieldMap,
  asNumber,
  asStringArray,
  asStringOrNull,
  detectCapabilities,
  isOkReply,
  type RedisCapabilities,
  type RedisCommand,
  send,
  sendSafe,
} from './raw';

/**
 * RediSearch / Redis Query Engine vector search.
 *
 * This is an *accelerator*, not the system of record: document embeddings live
 * in Postgres with pgvector (`packages/database/migrations/009_ai_memory.sql`),
 * which stays authoritative because it is transactional with the rows it
 * describes and works on every deployment. RediSearch is used when the server
 * actually runs the module (Redis Stack / Redis 8) over a TCP connection, and
 * every entry point here degrades to "not available" so the caller can fall
 * back instead of throwing.
 *
 * Serverless REST is deliberately excluded: a packed float32 vector is a binary
 * argument, and the JSON command encoding of the REST adapter cannot round-trip
 * it. `searchAvailability` reports that, rather than half-working.
 */

export type VectorAlgorithm = 'HNSW' | 'FLAT';

export type DistanceMetric = 'COSINE' | 'L2' | 'IP';

export type VectorDataType = 'FLOAT32';

export interface VectorIndexSpec {
  /** RediSearch index name, e.g. `arch:vector:documents`. */
  indexName: string;
  /** Hash-key prefix every indexed document shares, e.g. `arch:vector:doc:`. */
  keyPrefix: string;
  /** Hash field holding the packed vector. */
  vectorField: string;
  dimension: number;
  distanceMetric?: DistanceMetric;
  algorithm?: VectorAlgorithm;
  /** Text fields worth indexing for the hybrid (filter + vector) query. */
  textFields?: readonly string[];
  /** Numeric fields exposed as `NUMERIC` for range filters. */
  numericFields?: readonly string[];
  /** HNSW neighbour count per node. Ignored by FLAT. */
  m?: number;
  /** HNSW build-time candidate list size. Ignored by FLAT. */
  efConstruction?: number;
}

export interface VectorMatch {
  id: string;
  score: number;
  fields: Record<string, string>;
}

export interface VectorIndexStats {
  indexName: string;
  exists: boolean;
  numDocs: number;
  prefixes: string[];
}

/** Everything a search call needs, passed as one object to keep arity small. */
export interface VectorSearchQuery {
  spec: VectorIndexSpec;
  vector: Float32Array;
  /** Nearest neighbours to request. */
  k?: number;
  /** RediSearch filter expression, e.g. `@department:{drilling}`. */
  filter?: string;
  /** Fields to return; `__vector_score` and the id are always included. */
  returns?: readonly string[];
}

export interface VectorUpsert {
  spec: VectorIndexSpec;
  /** Document id, appended to `spec.keyPrefix` to form the hash key. */
  id: string;
  vector: Float32Array;
  fields?: Record<string, string | number>;
}

const DEFAULT_KNN_K = 10;
const DEFAULT_HNSW_M = 16;
const DEFAULT_HNSW_EF_CONSTRUCTION = 200;
const SEARCH_DIALECT = 2;
const SCORE_FIELD = '__vector_score';
const AS_SCORE = 'score';

export type SearchAvailability =
  | { available: true; reason?: undefined }
  | { available: false; reason: 'no-search-module' | 'serverless-rest' | 'unreachable' };

/**
 * Whether vector search can run here. Cached by `detectCapabilities` for a few
 * minutes, so this is cheap enough to call on every request.
 */
export async function searchAvailability(
  capabilities?: RedisCapabilities
): Promise<SearchAvailability> {
  const probe = capabilities ?? (await detectCapabilities().catch(() => null));
  if (!probe) return { available: false, reason: 'unreachable' };
  if (!probe.search) return { available: false, reason: 'no-search-module' };
  if (probe.transport !== 'tcp') return { available: false, reason: 'serverless-rest' };
  return { available: true };
}

/** Pack a vector the way RediSearch expects it: little-endian float32 bytes. */
export function encodeVector(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function vectorKey(spec: VectorIndexSpec, id: string): string {
  return `${spec.keyPrefix}${id}`;
}

type RedisHandle = Awaited<ReturnType<typeof getRedisClient>>;

async function requireClient(): Promise<RedisHandle | null> {
  try {
    return await getRedisClient();
  } catch {
    return null;
  }
}

function schemaTokens(spec: VectorIndexSpec): RedisCommand {
  const schema: RedisCommand = ['SCHEMA'];

  for (const field of spec.textFields ?? []) {
    schema.push(field, 'TEXT');
  }
  for (const field of spec.numericFields ?? []) {
    schema.push(field, 'NUMERIC');
  }

  const attributes: Array<[string, string | number]> = [
    ['TYPE', 'FLOAT32' satisfies VectorDataType],
    ['DISTANCE_METRIC', spec.distanceMetric ?? 'COSINE'],
    ['DIM', spec.dimension],
  ];
  if ((spec.algorithm ?? 'HNSW') === 'HNSW') {
    attributes.push(
      ['M', spec.m ?? DEFAULT_HNSW_M],
      ['EF_CONSTRUCTION', spec.efConstruction ?? DEFAULT_HNSW_EF_CONSTRUCTION]
    );
  }

  schema.push(spec.vectorField, 'VECTOR', spec.algorithm ?? 'HNSW', attributes.length * 2);
  for (const [name, value] of attributes) {
    schema.push(name, value);
  }
  return schema;
}

/**
 * Create the index if it does not exist. Returns false (never throws) when the
 * search module is unavailable or the server rejects the definition, so callers
 * keep working against pgvector.
 */
export async function ensureVectorIndex(spec: VectorIndexSpec): Promise<boolean> {
  const availability = await searchAvailability();
  if (!availability.available) return false;

  const redis = await requireClient();
  if (!redis) return false;

  const args: RedisCommand = [
    'FT.CREATE',
    spec.indexName,
    'ON',
    'HASH',
    'PREFIX',
    1,
    spec.keyPrefix,
    ...schemaTokens(spec),
  ];

  try {
    const reply = await send(redis, args);
    return isOkReply(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // RediSearch answers "Index already exists" on the second boot of a
    // long-lived server; that is success for an idempotent ensure().
    return message.toLowerCase().includes('already exists');
  }
}

/** Write one document. The hash key must start with `spec.keyPrefix`. */
export async function upsertVector(input: VectorUpsert): Promise<boolean> {
  const availability = await searchAvailability();
  if (!availability.available) return false;

  const redis = await requireClient();
  if (!redis) return false;

  const args: RedisCommand = [
    'HSET',
    vectorKey(input.spec, input.id),
    input.spec.vectorField,
    encodeVector(input.vector),
  ];
  for (const [field, value] of Object.entries(input.fields ?? {})) {
    args.push(field, String(value));
  }

  try {
    await send(redis, args);
    return true;
  } catch {
    return false;
  }
}

/** Drop the index (the documents themselves are untouched hashes). */
export async function dropVectorIndex(indexName: string): Promise<boolean> {
  const redis = await requireClient();
  if (!redis) return false;
  try {
    return isOkReply(await send(redis, ['FT.DROPINDEX', indexName]));
  } catch {
    return false;
  }
}

/**
 * FT.SEARCH hits, tolerant of both reply shapes:
 *  - RESP2: `[total, id, [field, value, ...], id, [...]]`
 *  - RESP3: `[total, [id, score, [field, value, ...]], ...]`
 *
 * A missing score becomes `MAX_SAFE_INTEGER` so callers sorting by ascending
 * distance (RediSearch reports distance, like pgvector) put it last.
 */
function asVectorMatches(reply: unknown): VectorMatch[] {
  if (!Array.isArray(reply)) return [];

  const matches: VectorMatch[] = [];
  for (let i = 1; i < reply.length; i += 1) {
    const row = reply[i];
    if (typeof row === 'string') {
      const fields = asFieldMap(reply[i + 1]);
      matches.push({ id: row, score: scoreOf(fields), fields });
      i += 1;
      continue;
    }
    if (Array.isArray(row)) {
      const id = asStringOrNull(row[0]);
      if (id === null) continue;
      const fields = asFieldMap(row.find((entry) => Array.isArray(entry)) ?? []);
      matches.push({ id, score: scoreFrom(row[1]) ?? scoreOf(fields), fields });
    }
  }
  return matches;
}

function scoreOf(fields: Record<string, string>): number {
  return scoreFrom(fields[AS_SCORE] ?? fields[SCORE_FIELD]) ?? Number.MAX_SAFE_INTEGER;
}

function scoreFrom(value: unknown): number | null {
  const text = asStringOrNull(value);
  if (text === null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * k-NN search. Returns an empty list whenever the index is missing or the query
 * is rejected — the caller's pgvector fallback should be indistinguishable from
 * "no similar documents", not an error page.
 */
export async function searchVectors(query: VectorSearchQuery): Promise<VectorMatch[]> {
  const availability = await searchAvailability();
  if (!availability.available) return [];

  const redis = await requireClient();
  if (!redis) return [];

  const k = Math.max(1, query.k ?? DEFAULT_KNN_K);
  // FT.SEARCH RETURN takes a token count, then `field [AS name]` groups.
  const returnTokens: RedisCommand = [SCORE_FIELD, 'AS', AS_SCORE, ...(query.returns ?? [])];
  const expression = `${query.filter ? `${query.filter}=>` : '*=>'}[KNN ${k} @${query.spec.vectorField} $VEC]`;

  const args: RedisCommand = [
    'FT.SEARCH',
    query.spec.indexName,
    expression,
    'PARAMS',
    2,
    'VEC',
    encodeVector(query.vector),
    'LIMIT',
    0,
    k,
    'RETURN',
    returnTokens.length,
    ...returnTokens,
    'DIALECT',
    SEARCH_DIALECT,
  ];

  try {
    return asVectorMatches(await send(redis, args));
  } catch {
    // Missing index, syntax error, or a dropped connection: all mean "use the
    // Postgres embeddings" from the caller's point of view.
    return [];
  }
}

/** Index statistics, used by health/observability routes. */
export async function vectorIndexStats(indexName: string): Promise<VectorIndexStats> {
  const base: VectorIndexStats = { indexName, exists: false, numDocs: 0, prefixes: [] };
  const redis = await requireClient();
  if (!redis) return base;

  const info = await sendSafe(redis, ['FT.INFO', indexName]);
  if (!Array.isArray(info)) return base;

  return {
    indexName,
    exists: true,
    numDocs: asNumber(infoValue(info, 'num_docs')),
    prefixes: asStringArray(infoValue(info, 'prefix') ?? []),
  };
}

/**
 * `FT.INFO` answers as nested `[field, value]` rows on RESP3 and as one flat
 * `[field, value, field, value]` array on RESP2. Both are seen in production
 * because the two transports of this monorepo speak different protocols.
 */
function infoValue(rows: readonly unknown[], field: string): unknown {
  for (const row of rows) {
    if (Array.isArray(row) && asStringOrNull(row[0]) === field) return row[1];
  }
  for (let i = 0; i + 1 < rows.length; i += 2) {
    if (asStringOrNull(rows[i]) === field) return rows[i + 1];
  }
  return null;
}
