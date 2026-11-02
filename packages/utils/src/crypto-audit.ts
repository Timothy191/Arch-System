import { createHash } from 'node:crypto';

export const GENESIS_PREVIOUS_HASH = '0'.repeat(64);
const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex';
const CANONICAL_SEPARATOR = '|prev:';

/**
 * Deterministically serialize any JSON-compatible object by recursively sorting keys.
 */
export function canonicalJsonStringify(record: unknown): string {
  if (record === null || typeof record !== 'object') {
    return JSON.stringify(record);
  }

  if (Array.isArray(record)) {
    return `[${record.map(canonicalJsonStringify).join(',')}]`;
  }

  const sortedKeys = Object.keys(record as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const val = (record as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalJsonStringify(val)}`;
  });

  return `{${pairs.join(',')}}`;
}

export interface HashRecordOptions {
  previousHash?: string | null;
}

/**
 * Computes a deterministic SHA-256 tamper-evident hash for a record linked to its predecessor.
 * Strips 'hash' and 'record_hash' fields if present to avoid recursive self-hashing.
 */
export function computeTamperEvidentHash<T extends Record<string, unknown>>(
  record: Readonly<T>,
  options: HashRecordOptions = {}
): string {
  const prevHash = options.previousHash || GENESIS_PREVIOUS_HASH;

  // Clone and exclude volatile hash fields
  const cleanRecord: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'hash' && key !== 'record_hash' && key !== 'previous_hash') {
      cleanRecord[key] = value;
    }
  }

  const canonicalPayload = canonicalJsonStringify(cleanRecord);
  const hashInput = `${canonicalPayload}${CANONICAL_SEPARATOR}${prevHash}`;

  return createHash(HASH_ALGORITHM).update(hashInput, 'utf8').digest(HASH_ENCODING);
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenIndex?: number;
  reason?: string;
}

export interface ChainedRecord {
  hash: string;
  previous_hash?: string | null;
  [key: string]: unknown;
}

/**
 * Validates the cryptographic tamper-evident integrity across a sequence of chained records.
 */
export function verifyTamperEvidentChain<T extends ChainedRecord>(
  chain: readonly T[]
): ChainVerificationResult {
  if (chain.length === 0) {
    return { isValid: true };
  }

  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index];
    if (!current) continue;

    const expectedPrevious =
      index === 0 ? GENESIS_PREVIOUS_HASH : (chain[index - 1]?.hash ?? GENESIS_PREVIOUS_HASH);

    const actualPrevious = current.previous_hash || GENESIS_PREVIOUS_HASH;

    if (actualPrevious !== expectedPrevious) {
      return {
        isValid: false,
        brokenIndex: index,
        reason: `Previous hash mismatch at index ${index}. Expected ${expectedPrevious} but got ${actualPrevious}.`,
      };
    }

    const recomputedHash = computeTamperEvidentHash(current, {
      previousHash: actualPrevious,
    });

    if (recomputedHash !== current.hash) {
      return {
        isValid: false,
        brokenIndex: index,
        reason: `Hash mismatch at index ${index}. Content has been tampered with or corrupted.`,
      };
    }
  }

  return { isValid: true };
}
