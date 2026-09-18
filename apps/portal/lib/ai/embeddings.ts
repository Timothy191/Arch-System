import crypto from "node:crypto";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { APIError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import { embeddingProviderRegistry } from "./provider-registry";

/**
 * Embedding cache service.
 *
 * NOTE: Embedding generation has been removed. This service now only provides
 * cache retrieval from existing stored embeddings. New embeddings cannot be generated.
 *
 * A multi-tier cache optimizes latency:
 * - L1 Cache (In-process Map): Caches SHA-256 hash -> vector to bypass DB queries.
 * - L2 Cache (PostgreSQL embedding_cache): User-isolated persistent vector store.
 *
 * To generate new embeddings, an external embedding service must be integrated.
 */

const EMBEDDING_DIMENSIONS = 768;

// ------------------------------------------------------------------
// L1 Cache (In-memory, size-capped at 512 entries, user-isolated)
// ------------------------------------------------------------------

const EMBEDDING_CACHE_MAX = 512;
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
    // Move to end (most recently used) by re-inserting
    embeddingCache.delete(key);
  } else if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    // Evict oldest entry if at capacity
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, vector);
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// Helper to compute SHA-256 hash of text
function computeHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ------------------------------------------------------------------
// L2 Cache (Database)
// ------------------------------------------------------------------

async function getDbCachedEmbedding(hash: string, userId: string): Promise<number[] | undefined> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("embedding_cache")
      .select("embedding")
      .eq("text_hash", hash)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logError(new Error(error.message), {
        context: "embedding_db_cache_lookup_failed",
        hash,
        userId,
      });
      return undefined;
    }

    if (data?.embedding) {
      if (typeof data.embedding === "string") {
        const clean = (data.embedding as string).replace(/[[\]\s]/g, "");
        return clean.split(",").map(Number);
      }
      return data.embedding as number[];
    }
  } catch (err) {
    logError(err, {
      context: "embedding_db_cache_lookup_exception",
      hash,
      userId,
    });
  }
  return undefined;
}

async function _saveDbCachedEmbedding(
  hash: string,
  userId: string,
  vector: number[]
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("embedding_cache").insert({
      text_hash: hash,
      user_id: userId,
      embedding: vector,
    });

    if (error) {
      // Postgres error code 23505 is unique violation (ON CONFLICT DO NOTHING equivalent)
      if (error.code === "23505") {
        return;
      }
      logError(new Error(error.message), {
        context: "embedding_db_cache_insert_failed",
        hash,
        userId,
      });
    }
  } catch (err) {
    logError(err, {
      context: "embedding_db_cache_insert_exception",
      hash,
      userId,
    });
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Retrieve an embedding vector for a single text string from cache.
 * NOTE: This function only retrieves cached embeddings. Generation has been removed.
 *
 * @throws {APIError} If embedding is not found in cache
 */
export async function generateEmbedding(
  text: string,
  userId: string,
  allowFallbackGeneration = true
): Promise<number[]> {
  const hash = computeHash(text);
  const cached = getCachedEmbedding(hash, userId);
  if (cached !== undefined) return cached;

  // L2 Database cache check
  const dbCached = await getDbCachedEmbedding(hash, userId);
  if (dbCached !== undefined) {
    setCachedEmbedding(hash, userId, dbCached);
    return dbCached;
  }

  if (allowFallbackGeneration) {
    const provider = embeddingProviderRegistry.getActiveProvider();
    const vector = await provider.generateEmbedding(text);
    setCachedEmbedding(hash, userId, vector);
    await _saveDbCachedEmbedding(hash, userId, vector);
    return vector;
  }

  // Embedding not found in cache and generation fallback disabled
  throw new APIError("Embedding not found in cache.", {
    statusCode: 503,
    context: { hash, userId, reason: "generation_disabled" },
  });
}

/**
 * Retrieve embeddings for multiple texts from cache with provider fallback.
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  userId: string,
  allowFallbackGeneration = true
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
      .from("embedding_cache")
      .select("text_hash, embedding")
      .eq("user_id", userId)
      .in("text_hash", pendingHashes);

    if (!error && data) {
      for (const row of data) {
        let vector: number[];
        if (typeof row.embedding === "string") {
          const clean = (row.embedding as string).replace(/[[\]\s]/g, "");
          vector = clean.split(",").map(Number);
        } else {
          vector = row.embedding as number[];
        }
        dbHits.set(row.text_hash, vector);
      }
    }
  } catch (dbErr) {
    logError(dbErr, {
      context: "embedding_batch_db_lookup_failed",
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

  if (missingIndices.length === 0) {
    return results;
  }

  if (allowFallbackGeneration) {
    const provider = embeddingProviderRegistry.getActiveProvider();
    const missingTexts = missingIndices.map((idx) => texts[idx]!);
    const generatedVectors = await provider.batchGenerateEmbeddings(missingTexts);

    for (let i = 0; i < missingIndices.length; i++) {
      const idx = missingIndices[i]!;
      const hash = hashes[idx]!;
      const vector = generatedVectors[i]!;

      results[idx] = vector;
      setCachedEmbedding(hash, userId, vector);
      await _saveDbCachedEmbedding(hash, userId, vector);
    }

    return results;
  }

  // If any embeddings are missing and fallback disabled, throw an error
  throw new APIError(
    `${missingIndices.length} embedding(s) not found in cache. Generation disabled.`,
    {
      statusCode: 503,
      context: { userId, missingIndices, reason: "generation_disabled" },
    }
  );
}

export { EMBEDDING_DIMENSIONS };
