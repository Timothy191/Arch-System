import { createServerSupabaseClient } from "@repo/supabase/server";
import { generateEmbedding, batchGenerateEmbeddings } from "./embeddings";
import { DatabaseError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import { withCache } from "@/lib/cache-utils";
import { CacheCategory } from "@repo/redis";

/**
 * Memory Service - Episodic and Semantic Memory for AI Chat
 *
 * Episodic: Conversation turns (short-term, session-scoped)
 * Semantic: Facts, preferences, knowledge (long-term, user-scoped)
 */

export type MemoryType = "episodic" | "semantic";

export interface MemoryEntry {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  metadata: Record<string, unknown>;
  memoryType: MemoryType;
  createdAt: string;
  similarity?: number;
  combinedScore?: number;
}

interface StoreMemoryInput {
  sessionId: string;
  userId: string;
  content: string;
  memoryType: MemoryType;
  metadata?: Record<string, unknown>;
}

interface RetrieveOptions {
  userId: string;
  query: string;
  sessionId?: string;
  memoryType?: MemoryType;
  limit?: number;
  similarityThreshold?: number;
  useHybridSearch?: boolean;
}

// ============================================
// Storage
// ============================================

/**
 * Store a memory entry with its embedding vector.
 */
export async function storeMemory(
  input: StoreMemoryInput,
): Promise<MemoryEntry> {
  const supabase = await createServerSupabaseClient();

  const embedding = await generateEmbedding(input.content, input.userId);

  const { data, error } = await supabase
    .from("memory_embeddings")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      content: input.content,
      embedding,
      metadata: input.metadata ?? {},
      memory_type: input.memoryType,
    })
    .select()
    .single();

  if (error) {
    logError(new Error(error.message), {
      context: "memory_store",
      table: "memory_embeddings",
    });
    throw new DatabaseError("Memory storage failed", {
      operation: "insert",
      table: "memories",
      context: { error: error.message },
    });
  }

  return mapRowToEntry(data);
}

/**
 * Batch store multiple memory entries.
 */
export async function storeMemories(
  inputs: StoreMemoryInput[],
): Promise<MemoryEntry[]> {
  if (inputs.length === 0) return [];

  const supabase = await createServerSupabaseClient();

  const firstInput = inputs[0];
  if (!firstInput) return [];

  // Generate embeddings in parallel
  const embeddings = await batchGenerateEmbeddings(
    inputs.map((i) => i.content),
    firstInput.userId,
  );

  const rows = inputs.map((input, idx) => ({
    session_id: input.sessionId,
    user_id: input.userId,
    content: input.content,
    embedding: embeddings[idx],
    metadata: input.metadata ?? {},
    memory_type: input.memoryType,
  }));

  const { data, error } = await supabase
    .from("memory_embeddings")
    .insert(rows)
    .select();

  if (error) {
    logError(new Error(error.message), {
      context: "memory_batch_store",
      table: "memory_embeddings",
    });
    throw new DatabaseError("Batch memory storage failed", {
      operation: "insert",
      table: "memories",
      context: { error: error.message },
    });
  }

  return (data ?? []).map(mapRowToEntry);
}

// ============================================
// Retrieval
// ============================================

/**
 * Retrieve relevant memories using hybrid search (semantic + keyword + temporal).
 * Best for general context retrieval.
 */
export async function retrieveRelevantMemories(
  options: RetrieveOptions,
): Promise<MemoryEntry[]> {
  const supabase = await createServerSupabaseClient();
  const embedding = await generateEmbedding(options.query, options.userId);

  const { data, error } = await supabase.rpc("search_memories_hybrid", {
    query_embedding: embedding,
    query_text: options.query,
    p_user_id: options.userId,
    p_session_id: options.sessionId ?? null,
    p_memory_type: options.memoryType ?? null,
    match_count: options.limit ?? 10,
    semantic_weight: 0.6,
    keyword_weight: 0.2,
    temporal_weight: 0.2,
  });

  if (error) {
    logError(new Error(error.message), { context: "memory_hybrid_search" });
    // Fallback to simple semantic search
    return retrieveSemanticMemories(options);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    userId: options.userId,
    content: row.content as string,
    metadata: row.metadata as Record<string, unknown>,
    memoryType: row.memory_type as MemoryType,
    createdAt: row.created_at as string,
    combinedScore: row.combined_score as number,
  }));
}

/**
 * Pure semantic search using HNSW index.
 * Faster but no keyword/temporal boost.
 */
export async function retrieveSemanticMemories(
  options: RetrieveOptions,
): Promise<MemoryEntry[]> {
  const supabase = await createServerSupabaseClient();
  const embedding = await generateEmbedding(options.query, options.userId);

  const { data, error } = await supabase.rpc("search_memories_semantic", {
    query_embedding: embedding,
    p_user_id: options.userId,
    p_session_id: options.sessionId ?? null,
    p_memory_type: options.memoryType ?? null,
    match_count: options.limit ?? 10,
    similarity_threshold: options.similarityThreshold ?? 0.7,
  });

  if (error) {
    logError(new Error(error.message), { context: "memory_semantic_search" });
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    userId: options.userId,
    content: row.content as string,
    metadata: row.metadata as Record<string, unknown>,
    memoryType: row.memory_type as MemoryType,
    createdAt: row.created_at as string,
    similarity: row.similarity as number,
  }));
}

/**
 * Get conversation history for a session (episodic memory).
 * Returns most recent messages first.
 */
export async function getConversationHistory(
  sessionId: string,
  userId: string,
  limit = 20,
): Promise<MemoryEntry[]> {
  return withCache(
    async () => {
      const supabase = await createServerSupabaseClient();

      const { data, error } = await supabase.rpc("get_conversation_history", {
        p_session_id: sessionId,
        p_user_id: userId,
        message_limit: limit,
      });

      if (error) {
        logError(new Error(error.message), {
          context: "memory_conversation_history",
          sessionId,
        });
        // Fallback to direct query
        const { data: fallbackData } = await supabase
          .from("memory_embeddings")
          .select("id, session_id, content, metadata, memory_type, created_at")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .eq("memory_type", "episodic")
          .order("created_at", { ascending: false })
          .limit(limit);

        return (fallbackData ?? []).map(mapRowToEntry);
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        sessionId: sessionId,
        userId: userId,
        content: row.content as string,
        metadata: row.metadata as Record<string, unknown>,
        memoryType: "episodic",
        createdAt: row.created_at as string,
      }));
    },
    {
      category: CacheCategory.AI_MEMORY,
      keyParts: [userId, sessionId, limit],
      tags: [`ai:${userId}`, "table:memory_embeddings"],
    },
  );
}

// ============================================
// Semantic Fact Store (long-term knowledge)
// ============================================

/**
 * Store a semantic fact (key-value pair with vector embedding).
 * Overwrites existing facts with the same key for this user.
 */
export async function storeSemanticFact(
  userId: string,
  key: string,
  value: string,
  metadata?: Record<string, unknown>,
): Promise<MemoryEntry> {
  const supabase = await createServerSupabaseClient();

  // Delete existing fact with same key
  await supabase
    .from("memory_embeddings")
    .delete()
    .eq("user_id", userId)
    .eq("memory_type", "semantic")
    .eq("metadata->>fact_key", key);

  return storeMemory({
    sessionId: "semantic",
    userId,
    content: `${key}: ${value}`,
    memoryType: "semantic",
    metadata: { fact_key: key, ...metadata },
  });
}

/**
 * Retrieve a specific semantic fact by key.
 */
export async function getSemanticFact(
  userId: string,
  key: string,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("memory_embeddings")
    .select("content")
    .eq("user_id", userId)
    .eq("memory_type", "semantic")
    .eq("metadata->>fact_key", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.content ?? null;
}

/**
 * Search semantic facts by query.
 */
export async function searchSemanticFacts(
  userId: string,
  query: string,
  limit = 5,
): Promise<MemoryEntry[]> {
  return retrieveRelevantMemories({
    userId,
    query,
    memoryType: "semantic",
    limit,
  });
}

// ============================================
// Utilities
// ============================================

function mapRowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    userId: row.user_id as string,
    content: row.content as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    memoryType: row.memory_type as MemoryType,
    createdAt: row.created_at as string,
  };
}

/**
 * Format memories into a context string for injection into LLM prompts.
 */
export function formatMemoriesForContext(memories: MemoryEntry[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => {
    const timestamp = new Date(m.createdAt).toLocaleString();
    const prefix =
      m.memoryType === "episodic" ? `[${timestamp}]` : `[${m.memoryType}]`;
    return `${prefix} ${m.content}`;
  });

  return `Relevant context from memory:\n${lines.join("\n")}\n`;
}

/**
 * Prune old episodic memories (keeps last 90 days).
 */
export async function pruneEpisodicMemories(
  userId: string,
  daysToKeep = 90,
): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const cutoff = new Date(
    Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("memory_embeddings")
    .delete()
    .eq("user_id", userId)
    .eq("memory_type", "episodic")
    .lt("created_at", cutoff);

  if (error) {
    logError(new Error(error.message), { context: "memory_prune", userId });
    return 0;
  }

  // Supabase doesn't return count on delete, so we can't know exactly
  return -1;
}
