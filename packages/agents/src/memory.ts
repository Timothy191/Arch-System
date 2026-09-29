import { createClient } from '@supabase/supabase-js';

export interface AgentMemoryEntry {
  agentId: string;
  conversationId?: string;
  sessionId?: string;
  memoryType: 'episodic' | 'semantic' | 'decision' | 'reflection' | 'rule' | 'fact' | 'context';
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
  importanceScore?: number;
}

export interface TokenMetricsEntry {
  conversationId?: string;
  agentId: string;
  modelId?: string;
  stepIndex?: number;
  tokensUsed: number;
  tokensCached: number;
  tokensSaved: number;
  metadata?: Record<string, unknown>;
}

export interface ContextSnapshotEntry {
  conversationId: string;
  agentId?: string;
  activeDocument?: string;
  openDocuments?: string[];
  cursorPosition?: Record<string, unknown>;
  contextState: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryOptions {
  queryEmbedding: number[];
  matchThreshold?: number;
  matchCount?: number;
  agentId?: string;
  memoryType?: AgentMemoryEntry['memoryType'];
}

/**
 * Client for storing and retrieving agent memories, token metrics, and context state.
 */
export class AgentMemoryStore {
  private supabase;

  constructor(options?: { supabaseUrl?: string; supabaseKey?: string }) {
    const url = options?.supabaseUrl || process.env.AGY_SUPABASE_URL || process.env.SUPABASE_URL;

    const key =
      options?.supabaseKey ||
      process.env.AGY_SUPABASE_SECRET_KEY ||
      process.env.AGY_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        'AgentMemoryStore requires Supabase URL and Key. Hardcoded fallback credentials have been purged for security.'
      );
    }

    this.supabase = createClient(url, key);
  }

  public async saveMemory(entry: AgentMemoryEntry) {
    const { data, error } = await this.supabase
      .from('agent_memories')
      .insert({
        agent_id: entry.agentId,
        conversation_id: entry.conversationId,
        session_id: entry.sessionId,
        memory_type: entry.memoryType,
        title: entry.title,
        content: entry.content,
        metadata: entry.metadata || {},
        importance_score: entry.importanceScore ?? 1.0,
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to persist agent memory:', error.message);
      return null;
    }
    return data;
  }

  /**
   * Retrieves semantically relevant memories using pgvector cosine distance.
   * Requires `match_memories` RPC function deployed in Supabase.
   */
  public async searchRelevantMemories(opts: SearchMemoryOptions) {
    const { data, error } = await this.supabase.rpc('match_memories', {
      query_embedding: opts.queryEmbedding,
      match_threshold: opts.matchThreshold ?? 0.75,
      match_count: opts.matchCount ?? 5,
      p_agent_id: opts.agentId || null,
      p_memory_type: opts.memoryType || null,
    });

    if (error) {
      console.warn('Failed to retrieve semantic memories:', error.message);
      return [];
    }
    return data;
  }

  public async logTokens(entry: TokenMetricsEntry) {
    const { data, error } = await this.supabase
      .from('token_metrics')
      .insert({
        conversation_id: entry.conversationId,
        agent_id: entry.agentId,
        model_id: entry.modelId,
        step_index: entry.stepIndex,
        tokens_used: entry.tokensUsed,
        tokens_cached: entry.tokensCached,
        tokens_saved: entry.tokensSaved,
        metadata: entry.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to log token metrics:', error.message);
      return null;
    }
    return data;
  }

  public async snapshotContext(entry: ContextSnapshotEntry) {
    const { data, error } = await this.supabase
      .from('context_snapshots')
      .insert({
        conversation_id: entry.conversationId,
        agent_id: entry.agentId,
        active_document: entry.activeDocument,
        open_documents: entry.openDocuments || [],
        cursor_position: entry.cursorPosition || {},
        context_state: entry.contextState,
        metadata: entry.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to snapshot context:', error.message);
      return null;
    }
    return data;
  }
}
