/** @jest-environment node */

import { Index } from '@upstash/vector';
import { getVectorIndex } from './vector';

jest.mock('server-only', () => ({}), { virtual: true });

describe('Upstash Vector client (lib/vector)', () => {
  const originalUrl = process.env.UPSTASH_VECTOR_REST_URL;
  const originalToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

  beforeEach(() => {
    process.env.UPSTASH_VECTOR_REST_URL = 'https://example-vector.upstash.io';
    process.env.UPSTASH_VECTOR_REST_TOKEN = 'test-vector-token';
  });

  afterAll(() => {
    process.env.UPSTASH_VECTOR_REST_URL = originalUrl;
    process.env.UPSTASH_VECTOR_REST_TOKEN = originalToken;
  });

  it('returns a singleton Index instance from env', () => {
    const first = getVectorIndex();
    const second = getVectorIndex();
    expect(first).toBeInstanceOf(Index);
    expect(second).toBe(first);
  });
});
