import {
  canonicalJsonStringify,
  computeTamperEvidentHash,
  GENESIS_PREVIOUS_HASH,
  verifyTamperEvidentChain,
} from './crypto-audit';

describe('canonicalJsonStringify', () => {
  it('serializes objects identically regardless of key order', () => {
    const objectA = { b: 2, a: 1, c: { y: 'bar', x: 'foo' } };
    const objectB = { a: 1, c: { x: 'foo', y: 'bar' }, b: 2 };

    expect(canonicalJsonStringify(objectA)).toBe(canonicalJsonStringify(objectB));
  });

  it('serializes arrays and primitives accurately', () => {
    expect(canonicalJsonStringify([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJsonStringify('test')).toBe('"test"');
    expect(canonicalJsonStringify(42)).toBe('42');
  });
});

describe('computeTamperEvidentHash', () => {
  it('generates consistent sha256 hash for identical data', () => {
    const record = { shift: 'day', supervisor: 'Smith', tons: 1200 };
    const hash1 = computeTamperEvidentHash(record);
    const hash2 = computeTamperEvidentHash({ tons: 1200, shift: 'day', supervisor: 'Smith' });

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hash when previousHash differs', () => {
    const record = { shift: 'day', supervisor: 'Smith' };
    const hashGenesis = computeTamperEvidentHash(record, {
      previousHash: GENESIS_PREVIOUS_HASH,
    });
    const hashChained = computeTamperEvidentHash(record, {
      previousHash: 'a'.repeat(64),
    });

    expect(hashGenesis).not.toBe(hashChained);
  });
});

describe('verifyTamperEvidentChain', () => {
  it('verifies a valid linear sequence of audit records', () => {
    const record1 = { id: 1, event: 'shift_start', operator: 'Alice' };
    const hash1 = computeTamperEvidentHash(record1, { previousHash: GENESIS_PREVIOUS_HASH });

    const chained1 = {
      ...record1,
      previous_hash: GENESIS_PREVIOUS_HASH,
      hash: hash1,
    };

    const record2 = { id: 2, event: 'blast_complete', operator: 'Bob' };
    const hash2 = computeTamperEvidentHash(record2, { previousHash: hash1 });

    const chained2 = {
      ...record2,
      previous_hash: hash1,
      hash: hash2,
    };

    const chain = [chained1, chained2];
    const verification = verifyTamperEvidentChain(chain);

    expect(verification.isValid).toBe(true);
  });

  it('detects tampering when payload content is modified', () => {
    const record1 = { id: 1, event: 'shift_start' };
    const hash1 = computeTamperEvidentHash(record1, { previousHash: GENESIS_PREVIOUS_HASH });
    const chained1 = { ...record1, previous_hash: GENESIS_PREVIOUS_HASH, hash: hash1 };

    const record2 = { id: 2, event: 'shift_closeout', tonnage: 500 };
    const hash2 = computeTamperEvidentHash(record2, { previousHash: hash1 });
    const chained2 = { ...record2, previous_hash: hash1, hash: hash2 };

    // Attacker modifies tonnage after signing
    chained2.tonnage = 900;

    const verification = verifyTamperEvidentChain([chained1, chained2]);
    expect(verification.isValid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.reason).toContain('Content has been tampered with or corrupted');
  });

  it('detects broken chain link when previous_hash does not match predecessor', () => {
    const record1 = { id: 1 };
    const hash1 = computeTamperEvidentHash(record1);
    const chained1 = { ...record1, previous_hash: GENESIS_PREVIOUS_HASH, hash: hash1 };

    const chained2 = {
      id: 2,
      previous_hash: 'f'.repeat(64), // Invalid predecessor
      hash: 'some_hash',
    };

    const verification = verifyTamperEvidentChain([chained1, chained2]);
    expect(verification.isValid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.reason).toContain('Previous hash mismatch');
  });
});
