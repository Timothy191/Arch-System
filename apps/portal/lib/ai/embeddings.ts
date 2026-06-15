import { ollamaEmbed } from "./ollama";
import { APIError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import { createServerSupabaseClient } from "@repo/supabase/server";
import crypto from "crypto";

/**
 * Embedding service for the AI memory system.
 *
 * Primary: Ollama nomic-embed-text:latest (768 dims — matches pgvector schema)
 *
 * A multi-tier cache optimizes latency:
 * - L1 Cache (In-process Map): Caches SHA-256 hash -> vector to bypass DB queries.
 * - L2 Cache (PostgreSQL embedding_cache): User-isolated persistent vector store.
 * - Local LLM (Ollama): Generates embeddings on cache misses.
 */

const EMBEDDING_DIMENSIONS = 768;
const EMBED_MODEL = "nomic-embed-text:latest";

// ------------------------------------------------------------------
// L1 Cache (In-memory, size-capped at 512 entries, user-isolated)
// ------------------------------------------------------------------

const EMBEDDING_CACHE_MAX = 512;
const embeddingCache = new Map<string, number[]>();

function getL1CacheKey(hash: string, userId: string): string {
  return `${userId}:${hash}`;
}

function getCachedEmbedding(
  hash: string,
  userId: string,
): number[] | undefined {
  const key = getL1CacheKey(hash, userId);
  const entry = embeddingCache.get(key);
  if (entry === undefined) return undefined;

  // LRU: Move to end (most recently used) by re-inserting
  embeddingCache.delete(key);
  embeddingCache.set(key, entry);
  return entry;
}

function setCachedEmbedding(
  hash: string,
  userId: string,
  vector: number[],
): void {
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

async function getDbCachedEmbedding(
  hash: string,
  userId: string,
): Promise<number[] | undefined> {
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
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "embedding_db_cache_lookup_exception",
      hash,
      userId,
    });
  }
  return undefined;
}

async function saveDbCachedEmbedding(
  hash: string,
  userId: string,
  vector: number[],
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
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "embedding_db_cache_insert_exception",
      hash,
      userId,
    });
  }
}

// ------------------------------------------------------------------
// Primary provider (Ollama)
// ------------------------------------------------------------------

class OllamaEmbeddingProvider {
  name = "ollama";

  async generate(text: string): Promise<number[]> {
    const result = await ollamaEmbed(text, { model: EMBED_MODEL });
    const vector = result[0];
    if (!vector) {
      throw new APIError("Ollama returned empty embedding data", {
        statusCode: 502,
        context: { provider: "ollama", reason: "empty_response" },
      });
    }
    return vector;
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    return ollamaEmbed(texts, { model: EMBED_MODEL });
  }
}

let primaryProvider: OllamaEmbeddingProvider | null = null;

function getPrimaryProvider(): OllamaEmbeddingProvider {
  if (!primaryProvider) {
    primaryProvider = new OllamaEmbeddingProvider();
  }
  return primaryProvider;
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Generate an embedding vector for a single text string.
 * Multi-tier caching: L1 Map -> L2 Database Cache -> Ollama.
 */
export async function generateEmbedding(
  text: string,
  userId: string,
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

  try {
    const vector = await getPrimaryProvider().generate(text);
    setCachedEmbedding(hash, userId, vector);
    // Persist to L2 cache defensively
    await saveDbCachedEmbedding(hash, userId, vector);
    return vector;
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "embedding_primary_failed",
    });
    throw err;
  }
}

/**
 * Generate embeddings for multiple texts in one batch call.
 * Multi-tier caching is done in bulk to minimize DB roundtrips.
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  userId: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
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
      logError(dbErr instanceof Error ? dbErr : new Error(String(dbErr)), {
        context: "embedding_batch_db_lookup_failed",
        userId,
      });
    }

    const needsGenerationIndices: number[] = [];
    const needsGenerationTexts: string[] = [];

    for (const idx of pendingIndices) {
      const hash = hashes[idx]!;
      const dbCached = dbHits.get(hash);
      if (dbCached !== undefined) {
        results[idx] = dbCached;
        setCachedEmbedding(hash, userId, dbCached);
      } else {
        needsGenerationIndices.push(idx);
        needsGenerationTexts.push(texts[idx]!);
      }
    }

    // Step 3: Local LLM generation for remaining misses
    if (needsGenerationTexts.length > 0) {
      const fresh =
        await getPrimaryProvider().batchGenerate(needsGenerationTexts);

      const dbInsertRows: {
        text_hash: string;
        user_id: string;
        embedding: number[];
      }[] = [];

      needsGenerationTexts.forEach((text, i) => {
        const origIdx = needsGenerationIndices[i]!;
        const vector = fresh[i];
        if (vector !== undefined) {
          const hash = hashes[origIdx]!;
          results[origIdx] = vector;
          setCachedEmbedding(hash, userId, vector);
          dbInsertRows.push({
            text_hash: hash,
            user_id: userId,
            embedding: vector,
          });
        }
      });

      // Persist new embeddings to L2 DB cache in a single batch insert
      if (dbInsertRows.length > 0) {
        try {
          const supabase = await createServerSupabaseClient();
          await supabase.from("embedding_cache").insert(dbInsertRows);
        } catch (dbInsertErr) {
          logError(
            dbInsertErr instanceof Error
              ? dbInsertErr
              : new Error(String(dbInsertErr)),
            {
              context: "embedding_batch_db_insert_failed",
              userId,
            },
          );
        }
      }
    }

    return results;
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "embedding_batch_primary_failed",
    });
    // Graceful degradation: individual calls
    return Promise.all(texts.map((t) => generateEmbedding(t, userId)));
  }
}

export { EMBEDDING_DIMENSIONS };
