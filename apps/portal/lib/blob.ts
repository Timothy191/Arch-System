import 'server-only';

import { Bucket, uniquePath } from '@upstash/blob';

let cachedBucket: Bucket | null = null;

/**
 * Returns the lazily initialized Upstash Blob bucket singleton (`UPSTASH_BLOB_TOKEN`).
 */
export function getBlobBucket(): Bucket {
  if (!cachedBucket) {
    cachedBucket = Bucket.fromEnv();
  }
  return cachedBucket;
}

export { uniquePath };
