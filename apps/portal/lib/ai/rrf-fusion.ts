/**
 * Reciprocal Rank Fusion (RRF) for Hybrid Vector and Full-Text Search.
 *
 * RRF combines rankings from multiple retrieval streams (e.g., semantic vector similarity
 * and full-text keyword search) without relying on sensitive scale normalization parameters.
 *
 * Formula:
 *   RRF_score(d) = sum_{m in M} ( w_m / (k + rank_m(d)) )
 *
 * Where:
 *   - M is the set of rankers (e.g., [vector_ranker, text_ranker])
 *   - w_m is the stream weight multiplier (default 1.0)
 *   - k is a smoothing constant (default 60)
 *   - rank_m(d) is the 1-indexed rank of document d in stream m
 */

export interface SearchItem {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RankedItem<T extends SearchItem = SearchItem> {
  item: T;
  rank: number;
  score?: number;
}

export interface RRFFusedResult<T extends SearchItem = SearchItem> {
  item: T;
  rrfScore: number;
  vectorRank?: number;
  keywordRank?: number;
}

export interface RRFOptions {
  k?: number; // Smoothing constant, default 60
  vectorWeight?: number; // Weight multiplier for vector stream, default 1.0
  keywordWeight?: number; // Weight multiplier for keyword stream, default 1.0
}

const DEFAULT_K = 60;

/**
 * Calculates Reciprocal Rank Fusion score for items present across multiple ranked lists.
 */
export function fuseVectorAndKeywordResults<T extends SearchItem = SearchItem>(
  vectorResults: T[],
  keywordResults: T[],
  options: RRFOptions = {}
): RRFFusedResult<T>[] {
  const k = options.k ?? DEFAULT_K;
  const vectorWeight = options.vectorWeight ?? 1.0;
  const keywordWeight = options.keywordWeight ?? 1.0;

  const resultMap = new Map<
    string,
    {
      item: T;
      vectorRank?: number;
      keywordRank?: number;
      rrfScore: number;
    }
  >();

  // Process vector search results (1-indexed ranking)
  vectorResults.forEach((item, index) => {
    const rank = index + 1;
    const scoreContribution = vectorWeight / (k + rank);

    const existing = resultMap.get(item.id);
    if (existing) {
      existing.vectorRank = rank;
      existing.rrfScore += scoreContribution;
    } else {
      resultMap.set(item.id, {
        item,
        vectorRank: rank,
        rrfScore: scoreContribution,
      });
    }
  });

  // Process keyword search results (1-indexed ranking)
  keywordResults.forEach((item, index) => {
    const rank = index + 1;
    const scoreContribution = keywordWeight / (k + rank);

    const existing = resultMap.get(item.id);
    if (existing) {
      existing.keywordRank = rank;
      existing.rrfScore += scoreContribution;
    } else {
      resultMap.set(item.id, {
        item,
        keywordRank: rank,
        rrfScore: scoreContribution,
      });
    }
  });

  // Sort descending by calculated RRF score
  const fused = Array.from(resultMap.values()).map((entry) => ({
    item: entry.item,
    rrfScore: entry.rrfScore,
    ...(entry.vectorRank !== undefined ? { vectorRank: entry.vectorRank } : {}),
    ...(entry.keywordRank !== undefined ? { keywordRank: entry.keywordRank } : {}),
  }));

  return fused.sort((a, b) => b.rrfScore - a.rrfScore);
}
