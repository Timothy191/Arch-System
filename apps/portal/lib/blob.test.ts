/** @jest-environment node */

import { Bucket } from '@upstash/blob';
import { getBlobBucket, uniquePath } from './blob';

jest.mock('server-only', () => ({}), { virtual: true });

describe('Upstash Blob client (lib/blob)', () => {
  const originalToken = process.env.UPSTASH_BLOB_TOKEN;

  beforeEach(() => {
    const syntheticBytes = Buffer.concat([
      Buffer.from([0x02, 0x00, 4, 0, 4, 4]),
      Buffer.from('test-test-aa'),
    ]);
    process.env.UPSTASH_BLOB_TOKEN = syntheticBytes.toString('base64url');
  });

  afterAll(() => {
    process.env.UPSTASH_BLOB_TOKEN = originalToken;
  });

  it('returns a singleton Bucket instance from env', () => {
    const first = getBlobBucket();
    const second = getBlobBucket();
    expect(first).toBeInstanceOf(Bucket);
    expect(second).toBe(first);
  });

  it('re-exports uniquePath helper for safe object keys', () => {
    const path = uniquePath`reports/${'shift-1.pdf'}`;
    expect(path).toMatch(/^reports\/shift-1-[A-Za-z0-9_-]+\.pdf$/);
  });
});
