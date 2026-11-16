import { searchAvailability, searchVectors, upsertVector } from '@repo/redis/search';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { logError } from '@/lib/errors/error-logger';
import { generateEmbedding } from './embeddings';
import { cosineDistanceToScore, ensureIndexOnce, MINING_VECTOR_SPEC } from './vector-indexes';

export interface BreakdownVectorItem {
  id: string;
  fleet_id: string;
  machine_type: string;
  reason: string;
  repair_notes?: string | null;
  status?: string;
}

export interface ShiftNoteVectorItem {
  id: string;
  shift_type: string;
  note_date: string;
  note_text: string;
  delay_minutes?: number | null;
}

export interface BreakdownSearchResult {
  id: string;
  breakdownId?: string;
  fleetId: string;
  machineType: string;
  reason: string;
  repairNotes?: string;
  score: number;
  createdAt: string;
}

export interface ShiftIntelligenceResult {
  id: string;
  noteId?: string;
  shiftType: string;
  noteDate: string;
  content: string;
  score: number;
  createdAt: string;
}

export interface SearchMemoriesHybridRow {
  id: string;
  session_id: string;
  content: string;
  metadata: unknown;
  memory_type: string;
  created_at: string;
  semantic_score: number;
  keyword_score: number;
  temporal_score: number;
  combined_score: number;
}

/**
 * Format breakdown details into high-density semantic text for vector search.
 */
export function formatBreakdownText(item: BreakdownVectorItem): string {
  const parts = [
    `Fleet: ${item.fleet_id}`,
    `Type: ${item.machine_type}`,
    `Symptom/Reason: ${item.reason}`,
  ];
  if (item.repair_notes && item.repair_notes.trim() !== '') {
    parts.push(`Repair/Resolution: ${item.repair_notes}`);
  }
  if (item.status) {
    parts.push(`Status: ${item.status}`);
  }
  return parts.join(' | ');
}

/**
 * Format shift notes into high-density semantic text for cross-shift intelligence.
 */
export function formatShiftNoteText(item: ShiftNoteVectorItem): string {
  const parts = [
    `Shift: ${item.shift_type.toUpperCase()}`,
    `Date: ${item.note_date}`,
    `Observation: ${item.note_text}`,
  ];
  if (item.delay_minutes && item.delay_minutes > 0) {
    parts.push(`Delay: ${item.delay_minutes} min`);
  }
  return parts.join(' | ');
}

/**
 * Index a machine breakdown into the semantic vector store.
 */
export async function indexBreakdownVector(
  item: BreakdownVectorItem,
  userId: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const text = formatBreakdownText(item);
    const vector = await generateEmbedding(text, userId);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('memory_embeddings')
      .insert({
        session_id: 'breakdowns',
        user_id: userId,
        content: text,
        embedding: JSON.stringify(vector),
        memory_type: 'semantic',
        metadata: {
          source: 'breakdown',
          breakdown_id: item.id,
          fleet_id: item.fleet_id,
          machine_type: item.machine_type,
          status: item.status || 'active',
        },
      })
      .select('id')
      .single();

    if (error) {
      logError(new Error(error.message), {
        context: 'index_breakdown_vector_failed',
        breakdownId: item.id,
      });
      return { success: false };
    }

    if (data?.id) {
      try {
        const availability = await searchAvailability();
        if (availability.available && (await ensureIndexOnce(MINING_VECTOR_SPEC))) {
          await upsertVector({
            spec: MINING_VECTOR_SPEC,
            id: data.id,
            vector: new Float32Array(vector),
            fields: {
              session_id: 'breakdowns',
              user_id: userId,
              content: text,
              source: 'breakdown',
              breakdown_id: item.id,
              fleet_id: item.fleet_id,
              machine_type: item.machine_type,
              repair_notes: item.repair_notes ?? '',
              status: item.status || 'active',
              created_at: new Date().toISOString(),
            },
          });
        }
      } catch (redisErr) {
        logError(redisErr instanceof Error ? redisErr : new Error(String(redisErr)), {
          context: 'index_breakdown_redis_stack_failed',
          breakdownId: item.id,
        });
      }
    }

    return { success: true, id: data?.id };
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'index_breakdown_vector_exception',
      breakdownId: item.id,
    });
    return { success: false };
  }
}

/**
 * Index a shift note into the semantic vector store.
 */
export async function indexShiftNoteVector(
  item: ShiftNoteVectorItem,
  userId: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const text = formatShiftNoteText(item);
    const vector = await generateEmbedding(text, userId);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('memory_embeddings')
      .insert({
        session_id: 'shift_notes',
        user_id: userId,
        content: text,
        embedding: JSON.stringify(vector),
        memory_type: 'semantic',
        metadata: {
          source: 'shift_note',
          note_id: item.id,
          shift_type: item.shift_type,
          note_date: item.note_date,
        },
      })
      .select('id')
      .single();

    if (error) {
      logError(new Error(error.message), {
        context: 'index_shift_note_vector_failed',
        noteId: item.id,
      });
      return { success: false };
    }

    if (data?.id) {
      try {
        const availability = await searchAvailability();
        if (availability.available && (await ensureIndexOnce(MINING_VECTOR_SPEC))) {
          await upsertVector({
            spec: MINING_VECTOR_SPEC,
            id: data.id,
            vector: new Float32Array(vector),
            fields: {
              session_id: 'shift_notes',
              user_id: userId,
              content: text,
              source: 'shift_note',
              note_id: item.id,
              shift_type: item.shift_type,
              note_date: item.note_date,
              created_at: new Date().toISOString(),
            },
          });
        }
      } catch (redisErr) {
        logError(redisErr instanceof Error ? redisErr : new Error(String(redisErr)), {
          context: 'index_shift_note_redis_stack_failed',
          noteId: item.id,
        });
      }
    }

    return { success: true, id: data?.id };
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'index_shift_note_vector_exception',
      noteId: item.id,
    });
    return { success: false };
  }
}

/**
 * Search past breakdown solutions and symptoms using hybrid vector + keyword matching.
 */
export async function searchSimilarBreakdowns(
  query: string,
  userId: string,
  matchCount = 5
): Promise<BreakdownSearchResult[]> {
  if (!query || query.trim() === '') return [];

  try {
    const vector = await generateEmbedding(query, userId);

    try {
      const availability = await searchAvailability();
      if (availability.available) {
        const matches = await searchVectors({
          spec: MINING_VECTOR_SPEC,
          vector: new Float32Array(vector),
          k: matchCount * 2,
          filter: '@session_id:breakdowns',
          returns: [
            'user_id',
            'breakdown_id',
            'fleet_id',
            'machine_type',
            'content',
            'repair_notes',
            'created_at',
          ],
        });
        const scoped = matches.filter((m) => m.fields.user_id === userId).slice(0, matchCount);
        if (scoped.length > 0) {
          return scoped.map((m) => ({
            id: m.id,
            breakdownId: m.fields.breakdown_id || undefined,
            fleetId: m.fields.fleet_id || 'Fleet Unit',
            machineType: m.fields.machine_type || 'Equipment',
            reason: m.fields.content || '',
            repairNotes: m.fields.repair_notes || undefined,
            score: cosineDistanceToScore(m.score),
            createdAt: m.fields.created_at || new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Non-fatal: fall back to Postgres pgvector RPC
    }

    const supabase = await createServerSupabaseClient();

    // Call PostgreSQL hybrid search RPC
    const { data, error } = await supabase.rpc('search_memories_hybrid', {
      query_embedding: JSON.stringify(vector),
      query_text: query,
      p_user_id: userId,
      p_session_id: 'breakdowns',
      p_memory_type: 'semantic',
      match_count: matchCount,
      semantic_weight: 0.7,
      keyword_weight: 0.2,
      temporal_weight: 0.1,
    });

    if (error) {
      logError(new Error(error.message), {
        context: 'search_similar_breakdowns_rpc_failed',
        query,
      });
      return [];
    }

    if (!data || data.length === 0) return [];

    return (data as SearchMemoriesHybridRow[]).map((row) => {
      const meta = (row.metadata as Record<string, unknown>) || {};
      return {
        id: row.id,
        breakdownId: meta.breakdown_id as string | undefined,
        fleetId: (meta.fleet_id as string) || 'Fleet Unit',
        machineType: (meta.machine_type as string) || 'Equipment',
        reason: row.content,
        repairNotes: meta.repair_notes as string | undefined,
        score: Math.round((row.combined_score ?? 0) * 100),
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'search_similar_breakdowns_exception',
      query,
    });
    return [];
  }
}

/**
 * Search shift notes and delay logs for cross-shift intelligence and handover context.
 */
export async function searchShiftIntelligence(
  query: string,
  userId: string,
  matchCount = 5
): Promise<ShiftIntelligenceResult[]> {
  if (!query || query.trim() === '') return [];

  try {
    const vector = await generateEmbedding(query, userId);

    try {
      const availability = await searchAvailability();
      if (availability.available) {
        const matches = await searchVectors({
          spec: MINING_VECTOR_SPEC,
          vector: new Float32Array(vector),
          k: matchCount * 2,
          filter: '@session_id:shift_notes',
          returns: ['user_id', 'note_id', 'shift_type', 'note_date', 'content', 'created_at'],
        });
        const scoped = matches.filter((m) => m.fields.user_id === userId).slice(0, matchCount);
        if (scoped.length > 0) {
          return scoped.map((m) => ({
            id: m.id,
            noteId: m.fields.note_id || undefined,
            shiftType: m.fields.shift_type || 'shift',
            noteDate: m.fields.note_date || '',
            content: m.fields.content || '',
            score: cosineDistanceToScore(m.score),
            createdAt: m.fields.created_at || new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Non-fatal: fall back to Postgres pgvector RPC
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('search_memories_hybrid', {
      query_embedding: JSON.stringify(vector),
      query_text: query,
      p_user_id: userId,
      p_session_id: 'shift_notes',
      p_memory_type: 'semantic',
      match_count: matchCount,
      semantic_weight: 0.6,
      keyword_weight: 0.2,
      temporal_weight: 0.2,
    });

    if (error) {
      logError(new Error(error.message), {
        context: 'search_shift_intelligence_rpc_failed',
        query,
      });
      return [];
    }

    if (!data || data.length === 0) return [];

    return (data as SearchMemoriesHybridRow[]).map((row) => {
      const meta = (row.metadata as Record<string, unknown>) || {};
      return {
        id: row.id,
        noteId: meta.note_id as string | undefined,
        shiftType: (meta.shift_type as string) || 'shift',
        noteDate: (meta.note_date as string) || '',
        content: row.content,
        score: Math.round((row.combined_score ?? 0) * 100),
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'search_shift_intelligence_exception',
      query,
    });
    return [];
  }
}
