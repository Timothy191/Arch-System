import crypto from 'node:crypto';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { APIError } from '@/lib/errors/error-classes';
import { logError } from '@/lib/errors/error-logger';

/**
 * Enterprise Embedding Service.
 *
 * Provides vector embedding generation and caching:
 * - L1 Cache: In-process LRU map (SHA-256 hash -> vector) to avoid repeated queries.
 * - L2 Cache: PostgreSQL user-isolated persistent vector store (`embedding_cache`), populated
 *   strictly with genuine semantic vectors (never deterministic hash fallbacks).
 * - Primary Engine: Configured Ollama `nomic-embed-text` (768 dimensions).
 * - Secondary Engine: OpenAI `text-embedding-3-small` (dimensions: 768) if configured.
 * - Offline/Test Fallback: Deterministic unit-normalized projection strictly for unit tests;
 *   semantic callers (`requireSemantic: true`) receive an explicit 503 configuration error
 *   when neither `OPENAI_API_KEY` nor a reachable `OLLAMA_BASE_URL` is available.
 */

const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_CACHE_MAX = 512;
const OLLAMA_TIMEOUT_MS = 4000;
const OPENAI_TIMEOUT_MS = 5000;

export interface EmbeddingOptions {
  /**
   * When true, refuses deterministic hash fallback and throws an explicit
   * configuration error if neither Ollama nor OpenAI produces a semantic vector.
   */
  readonly requireSemantic?: boolean;
}

type ProviderFetchOutcome = {
  readonly vector: number[];
  readonly isSemantic: boolean;
};

// ------------------------------------------------------------------
// L1 Cache (In-memory, size-capped at 512 entries, user-isolated)
// ------------------------------------------------------------------

const embeddingCache = new Map<string, number[]>();

function getL1CacheKey(hash: string, userId: string): string {
  return `${userId}:${hash}`;
}

function getCachedEmbedding(hash: string, userId: string): number[] | undefined {
  const key = getL1CacheKey(hash, userId);
  const entry = embeddingCache.get(key);
  if (entry === undefined) return undefined;

  // LRU: Move to end (most recently used) by re-inserting
  embeddingCache.delete(key);
  embeddingCache.set(key, entry);
  return entry;
}

function setCachedEmbedding(hash: string, userId: string, vector: number[]): void {
  const key = getL1CacheKey(hash, userId);
  if (embeddingCache.has(key)) {
    embeddingCache.delete(key);
  } else if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, vector);
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

function computeHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function isSemanticEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.OLLAMA_BASE_URL?.trim());
}

// ------------------------------------------------------------------
// L2 Cache (Database)
// ------------------------------------------------------------------

async function getDbCachedEmbedding(hash: string, userId: string): Promise<number[] | undefined> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('embedding')
      .eq('text_hash', hash)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logError(new Error(error.message), {
        context: 'embedding_db_cache_lookup_failed',
        hash,
        userId,
      });
      return undefined;
    }

    if (data?.embedding) {
      if (typeof data.embedding === 'string') {
        const clean = (data.embedding as string).replace(/[[\]\s]/g, '');
        return clean.split(',').map(Number);
      }
      return data.embedding as number[];
    }
  } catch (err) {
    logError(err, {
      context: 'embedding_db_cache_lookup_exception',
      hash,
      userId,
    });
  }
  return undefined;
}

async function saveDbCachedEmbedding(
  hash: string,
  userId: string,
  vector: number[]
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('embedding_cache').insert({
      text_hash: hash,
      user_id: userId,
      embedding: vector,
    });

    if (error) {
      // Postgres error code 23505 is unique violation (ON CONFLICT DO NOTHING equivalent)
      if (error.code === '23505') {
        return;
      }
      logError(new Error(error.message), {
        context: 'embedding_db_cache_insert_failed',
        hash,
        userId,
      });
    }
  } catch (err) {
    logError(err, {
      context: 'embedding_db_cache_insert_exception',
      hash,
      userId,
    });
  }
}

// ------------------------------------------------------------------
// Vector Generators (Neural + Deterministic Fallback)
// ------------------------------------------------------------------

/**
 * Deterministic vector generator for offline unit/CI test environments.
 * Produces unit-normalized 768-dimensional vectors.
 */
export function generateDeterministicEmbedding(
  text: string,
  dimensions = EMBEDDING_DIMENSIONS
): number[] {
  const vector: number[] = new Array(dimensions);
  let norm = 0;

  for (let i = 0; i < dimensions; i++) {
    const h = crypto.createHash('sha256').update(`${text}:${i}`).digest();
    const val = h.readInt32BE(0) / 2147483647.0;
    vector[i] = val;
    norm += val * val;
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i]! / norm;
    }
  }
  return vector;
}

async function fetchEmbeddingFromProvider(
  text: string,
  options?: EmbeddingOptions
): Promise<ProviderFetchOutcome> {
  const configuredOllamaUrl = process.env.OLLAMA_BASE_URL?.trim();
  const ollamaBaseUrl =
    configuredOllamaUrl ||
    (!process.env.VERCEL && process.env.NODE_ENV !== 'test' ? 'http://localhost:11434' : '');
  const ollamaModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

  // 1. Try Ollama instance when configured or running locally
  if (ollamaBaseUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const response = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const payload = (await response.json()) as { embedding?: number[] };
        if (Array.isArray(payload.embedding) && payload.embedding.length === EMBEDDING_DIMENSIONS) {
          return { vector: payload.embedding, isSemantic: true };
        }
      }
    } catch {
      // Ollama not reachable or timed out — try OpenAI next
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Try OpenAI API if key is explicitly configured
  if (process.env.OPENAI_API_KEY?.trim()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          data?: Array<{ embedding?: number[] }>;
        };
        const vector = payload?.data?.[0]?.embedding;
        if (Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS) {
          return { vector, isSemantic: true };
        }
      }
    } catch {
      // Fall through to explicit error or test-only deterministic fallback
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const mustBeSemantic =
    options?.requireSemantic === true ||
    (process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_DETERMINISTIC_EMBEDDING_FALLBACK !== 'true');

  if (mustBeSemantic) {
    throw new APIError(
      'Semantic embedding provider unavailable: configure OPENAI_API_KEY or a reachable OLLAMA_BASE_URL.',
      { statusCode: 503, context: { component: 'embeddings' } }
    );
  }

  // 3. Deterministic unit-normalized fallback strictly for offline CI/test environments
  return {
    vector: generateDeterministicEmbedding(text, EMBEDDING_DIMENSIONS),
    isSemantic: false,
  };
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Generate or retrieve an embedding vector for a single text string.
 */
export async function generateEmbedding(
  text: string,
  userId: string,
  options?: EmbeddingOptions
): Promise<number[]> {
  if (!text || text.trim() === '') {
    throw new APIError('Cannot generate embedding for empty text', { statusCode: 400 });
  }

  const hash = computeHash(text);
  const cached = getCachedEmbedding(hash, userId);
  if (cached !== undefined) return cached;

  // L2 Database cache check
  const dbCached = await getDbCachedEmbedding(hash, userId);
  if (dbCached !== undefined) {
    setCachedEmbedding(hash, userId, dbCached);
    return dbCached;
  }

  // Generate fresh embedding
  const { vector, isSemantic } = await fetchEmbeddingFromProvider(text, options);
  setCachedEmbedding(hash, userId, vector);

  if (isSemantic) {
    void saveDbCachedEmbedding(hash, userId, vector);
  }

  return vector;
}

/**
 * Generate or retrieve embedding vectors for multiple texts.
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  userId: string,
  options?: EmbeddingOptions
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const hashes = texts.map(computeHash);
  const results: number[][] = new Array(texts.length);
  const pendingIndices: number[] = [];
  const pendingHashes: string[] = [];

  // Step 1: L1 cache check
  for (let i = 0; i < texts.length; i++) {
    const hash = hashes[i]!;
    const cached = getCachedEmbedding(hash, userId);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      pendingIndices.push(i);
      pendingHashes.push(hash);
    }
  }

  if (pendingIndices.length === 0) {
    return results;
  }

  // Step 2: L2 Database cache check (bulk query)
  const dbHits = new Map<string, number[]>();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('text_hash, embedding')
      .eq('user_id', userId)
      .in('text_hash', pendingHashes);

    if (!error && data) {
      for (const row of data) {
        let vector: number[];
        if (typeof row.embedding === 'string') {
          const clean = (row.embedding as string).replace(/[[\]\s]/g, '');
          vector = clean.split(',').map(Number);
        } else {
          vector = row.embedding as number[];
        }
        dbHits.set(row.text_hash, vector);
      }
    }
  } catch (dbErr) {
    logError(dbErr, {
      context: 'embedding_batch_db_lookup_failed',
      userId,
    });
  }

  const missingIndices: number[] = [];

  for (const idx of pendingIndices) {
    const hash = hashes[idx]!;
    const dbCached = dbHits.get(hash);
    if (dbCached !== undefined) {
      results[idx] = dbCached;
      setCachedEmbedding(hash, userId, dbCached);
    } else {
      missingIndices.push(idx);
    }
  }

  // Step 3: Generate missing embeddings in parallel
  if (missingIndices.length > 0) {
    await Promise.all(
      missingIndices.map(async (idx) => {
        const text = texts[idx]!;
        const hash = hashes[idx]!;
        const { vector, isSemantic } = await fetchEmbeddingFromProvider(text, options);
        results[idx] = vector;
        setCachedEmbedding(hash, userId, vector);
        if (isSemantic) {
          void saveDbCachedEmbedding(hash, userId, vector);
        }
      })
    );
  }

  return results;
}

export { EMBEDDING_DIMENSIONS };
