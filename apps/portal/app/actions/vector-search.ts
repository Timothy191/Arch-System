'use server';

import { AuthError, isAppError, ValidationError } from '@repo/errors';
import { getAuthenticatedEmployee } from '@repo/supabase';
import {
  type BreakdownSearchResult,
  type BreakdownVectorItem,
  indexBreakdownVector,
  indexShiftNoteVector,
  type ShiftIntelligenceResult,
  type ShiftNoteVectorItem,
  searchShiftIntelligence,
  searchSimilarBreakdowns,
} from '@/lib/ai/mining-rag';
import { logError } from '@/lib/errors/error-logger';

export interface ServerActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Server action to search historical breakdown solutions and symptoms via vector embeddings.
 */
export async function searchBreakdownDiagnosticsAction(
  rawQuery: unknown
): Promise<ServerActionResponse<BreakdownSearchResult[]>> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    if (typeof rawQuery !== 'string' || rawQuery.trim() === '') {
      return { success: true, data: [] };
    }

    const query = rawQuery.trim();
    if (query.length > 500) {
      throw new ValidationError('Query too long. Please limit to 500 characters.');
    }

    const results = await searchSimilarBreakdowns(query, principal.user.id);
    return { success: true, data: results };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'APP_ERROR' };
    }
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'search_breakdown_diagnostics_action',
    });
    return {
      success: false,
      error: 'Failed to search breakdown diagnostics',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Server action to search past shift notes and delays across departments for cross-shift intelligence.
 */
export async function searchShiftIntelligenceAction(
  rawQuery: unknown
): Promise<ServerActionResponse<ShiftIntelligenceResult[]>> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    if (typeof rawQuery !== 'string' || rawQuery.trim() === '') {
      return { success: true, data: [] };
    }

    const query = rawQuery.trim();
    if (query.length > 500) {
      throw new ValidationError('Query too long. Please limit to 500 characters.');
    }

    const results = await searchShiftIntelligence(query, principal.user.id);
    return { success: true, data: results };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'APP_ERROR' };
    }
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'search_shift_intelligence_action',
    });
    return { success: false, error: 'Failed to search shift intelligence', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Server action to index a breakdown into the semantic vector store.
 */
export async function indexBreakdownAction(
  item: BreakdownVectorItem
): Promise<ServerActionResponse<{ indexed: boolean }>> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    if (!item.fleet_id || !item.reason) {
      throw new ValidationError('Fleet ID and reason are required for indexing.');
    }

    const result = await indexBreakdownVector(item, principal.user.id);
    return { success: result.success, data: { indexed: result.success } };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'APP_ERROR' };
    }
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'index_breakdown_action',
    });
    return { success: false, error: 'Failed to index breakdown vector', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Server action to index a shift note into the semantic vector store.
 */
export async function indexShiftNoteAction(
  item: ShiftNoteVectorItem
): Promise<ServerActionResponse<{ indexed: boolean }>> {
  try {
    const principal = await getAuthenticatedEmployee();
    if (!principal) {
      throw new AuthError('Unauthorized');
    }

    if (!item.note_text) {
      throw new ValidationError('Note text is required for indexing.');
    }

    const result = await indexShiftNoteVector(item, principal.user.id);
    return { success: result.success, data: { indexed: result.success } };
  } catch (err) {
    if (isAppError(err)) {
      return { success: false, error: err.message, code: err.code ?? 'APP_ERROR' };
    }
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'index_shift_note_action',
    });
    return { success: false, error: 'Failed to index shift note vector', code: 'INTERNAL_ERROR' };
  }
}
