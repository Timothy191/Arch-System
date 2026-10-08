import {
  batchGenerateEmbeddings,
  clearEmbeddingCache,
  EMBEDDING_DIMENSIONS,
  generateDeterministicEmbedding,
  generateEmbedding,
} from './embeddings';

// Mock Supabase server client
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockIn = jest.fn();
const mockEq2 = jest.fn();
const mockEq1 = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (cols: string) => {
          mockSelect(cols);
          return {
            eq: (col1: string, val1: unknown) => {
              mockEq1(col1, val1);
              return {
                eq: (col2: string, val2: unknown) => {
                  mockEq2(col2, val2);
                  return {
                    maybeSingle: mockMaybeSingle,
                  };
                },
                in: (col2: string, val2: unknown[]) => {
                  mockIn(col2, val2);
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert: mockInsert,
      };
    },
  }),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

describe('embeddings service', () => {
  beforeEach(() => {
    clearEmbeddingCache();
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe('generateDeterministicEmbedding', () => {
    it('produces exactly 768 dimensions', () => {
      const vec = generateDeterministicEmbedding('test input');
      expect(vec).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(vec.every((v) => typeof v === 'number' && !Number.isNaN(v))).toBe(true);
    });

    it('produces unit-normalized vectors (magnitude approx 1.0)', () => {
      const vec = generateDeterministicEmbedding('mining telemetry sample');
      const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 4);
    });

    it('is completely deterministic for identical input', () => {
      const vec1 = generateDeterministicEmbedding('CAT 777D hydraulic leak');
      const vec2 = generateDeterministicEmbedding('CAT 777D hydraulic leak');
      expect(vec1).toEqual(vec2);
    });
  });

  describe('generateEmbedding', () => {
    it('throws APIError for empty text', async () => {
      await expect(generateEmbedding('', 'user-1')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
      await expect(generateEmbedding('   ', 'user-1')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
    });

    it('generates, caches in L1, and returns 768-dim vector', async () => {
      const vec = await generateEmbedding('Brakfontein pit delay', 'user-1');
      expect(vec).toHaveLength(768);

      // Second call should hit L1 in-memory cache directly without checking DB
      const cachedVec = await generateEmbedding('Brakfontein pit delay', 'user-1');
      expect(cachedVec).toEqual(vec);
      // DB select was called only once on the first cold miss
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    it('retrieves from L2 database cache on L1 cold miss', async () => {
      const fakeDbVector = new Array(768).fill(0.01);
      mockMaybeSingle.mockResolvedValueOnce({
        data: { embedding: fakeDbVector },
        error: null,
      });

      const vec = await generateEmbedding('cold text in db', 'user-2');
      expect(vec).toEqual(fakeDbVector);
    });
  });

  describe('batchGenerateEmbeddings', () => {
    it('returns empty array when input is empty', async () => {
      const results = await batchGenerateEmbeddings([], 'user-1');
      expect(results).toEqual([]);
    });

    it('generates embeddings for multiple texts', async () => {
      const texts = ['excavator delay', 'haul truck breakdown', 'weather rain delay'];
      const results = await batchGenerateEmbeddings(texts, 'user-1');

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveLength(768);
      expect(results[1]).toHaveLength(768);
      expect(results[2]).toHaveLength(768);
    });
  });
});
