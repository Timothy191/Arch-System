import { ensureVectorIndex, type VectorIndexSpec } from '@repo/redis/search';

const EMBEDDING_DIMENSION = 768;
const MAX_SCORE_PCT = 100;
const COSINE_DISTANCE_RANGE = 2;

export const MINING_VECTOR_SPEC: VectorIndexSpec = {
  indexName: 'arch:vector:mining',
  keyPrefix: 'arch:vector:mining:',
  vectorField: 'embedding',
  dimension: EMBEDDING_DIMENSION,
  distanceMetric: 'COSINE',
  algorithm: 'HNSW',
  textFields: [
    'session_id',
    'user_id',
    'content',
    'source',
    'fleet_id',
    'machine_type',
    'repair_notes',
    'status',
    'shift_type',
    'note_date',
    'breakdown_id',
    'note_id',
    'created_at',
  ],
};

export const DOCUMENTS_VECTOR_SPEC: VectorIndexSpec = {
  indexName: 'arch:vector:documents',
  keyPrefix: 'arch:vector:doc:',
  vectorField: 'embedding',
  dimension: EMBEDDING_DIMENSION,
  distanceMetric: 'COSINE',
  algorithm: 'HNSW',
  textFields: ['session_id', 'user_id', 'content', 'source', 'source_id', 'title'],
};

const ensuredIndexes = new Set<string>();

/**
 * Ensure a RediSearch vector index exists once per process, resetting on failure
 * so transient outages do not permanently disable indexing.
 */
export async function ensureIndexOnce(spec: VectorIndexSpec): Promise<boolean> {
  if (ensuredIndexes.has(spec.indexName)) return true;
  const isReady = await ensureVectorIndex(spec);
  if (isReady) {
    ensuredIndexes.add(spec.indexName);
  }
  return isReady;
}

/** Convert RediSearch cosine distance (0..2) to a 0..100 similarity score. */
export function cosineDistanceToScore(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.max(
    0,
    Math.min(MAX_SCORE_PCT, Math.round((1 - distance / COSINE_DISTANCE_RANGE) * MAX_SCORE_PCT))
  );
}
