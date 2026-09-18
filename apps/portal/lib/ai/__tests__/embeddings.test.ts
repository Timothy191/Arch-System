const mockFrom = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

import { batchGenerateEmbeddings, clearEmbeddingCache, generateEmbedding } from "../embeddings";

describe("Embeddings Cache & Provider Integration", () => {
  beforeEach(() => {
    clearEmbeddingCache();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  it("generates embeddings using active provider when cache misses", async () => {
    const vector = await generateEmbedding("sample test query", "user-123", true);

    expect(vector).toBeDefined();
    expect(vector.length).toBeGreaterThan(0);

    // Subsequent call should hit L1 memory cache
    const cachedVector = await generateEmbedding("sample test query", "user-123", false);
    expect(cachedVector).toEqual(vector);
  });

  it("batch generates embeddings with provider fallback", async () => {
    const texts = ["query one", "query two"];
    const results = await batchGenerateEmbeddings(texts, "user-456", true);

    expect(results).toHaveLength(2);
    expect(results[0]?.length).toBeGreaterThan(0);
    expect(results[1]?.length).toBeGreaterThan(0);
  });
});
