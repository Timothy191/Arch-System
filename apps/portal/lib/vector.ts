import 'server-only';

import { Index } from '@upstash/vector';

let cachedIndex: Index | null = null;

/**
 * Returns the lazily initialized Upstash Vector index singleton
 * (`UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`).
 */
export function getVectorIndex<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(): Index<TMetadata> {
  if (!cachedIndex) {
    cachedIndex = Index.fromEnv();
  }
  return cachedIndex as Index<TMetadata>;
}
