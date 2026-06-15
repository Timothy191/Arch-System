/**
 * @jest-environment node
 */
import { EMBEDDING_DIMENSIONS, clearEmbeddingCache } from "./embeddings";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("./ollama", () => ({
  ...jest.requireActual("./ollama"),
  ollamaEmbed: jest.fn(),
}));

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);

function makeOllamaEmbeddingResponse(vectors: number[][]): number[][] {
  return vectors;
}

const mockUserId = "d3b07384-d113-4956-a5cc-7c1122334455";

// Unified Supabase mock object
let mockSupabase: any;

beforeEach(() => {
  jest.clearAllMocks();
  clearEmbeddingCache();

  mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
  };
  createServerSupabaseClient.mockResolvedValue(mockSupabase);
});

// ---------------------------------------------------------------------------
// EMBEDDING_DIMENSIONS constant
// ---------------------------------------------------------------------------

describe("EMBEDDING_DIMENSIONS", () => {
  it("is 768 for nomic-embed-text", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});

// ---------------------------------------------------------------------------
// generateEmbedding — Ollama primary provider
// ---------------------------------------------------------------------------

describe("generateEmbedding", () => {
  it("returns embedding vector from Ollama and stores in DB cache on miss", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const vector = Array(768).fill(0.1);
    (ollamaEmbed as jest.Mock).mockResolvedValue(
      makeOllamaEmbeddingResponse([vector]),
    );

    const { generateEmbedding: gen } = await import("./embeddings");
    const result = await gen("test text", mockUserId);

    expect(result).toEqual(vector);
    expect(ollamaEmbed).toHaveBeenCalledWith(
      "test text",
      expect.objectContaining({ model: "nomic-embed-text:latest" }),
    );
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUserId,
        embedding: vector,
      }),
    );
  });

  it("returns cached embedding from DB (L2) directly without calling Ollama", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const dbVector = Array(768).fill(0.2);
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { embedding: dbVector },
      error: null,
    });

    const { generateEmbedding: gen } = await import("./embeddings");
    const result = await gen("db cache test", mockUserId);

    expect(result).toEqual(dbVector);
    expect(ollamaEmbed).not.toHaveBeenCalled();
    expect(mockSupabase.select).toHaveBeenCalled();
  });

  it("throws when Ollama fails and DB has no cache", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    (ollamaEmbed as jest.Mock).mockRejectedValue(new Error("Ollama down"));

    const { generateEmbedding: gen } = await import("./embeddings");
    await expect(gen("text", mockUserId)).rejects.toThrow("Ollama down");
  });

  it("returns cached value on second call with same text from L1 (memory) directly", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const vector = Array(768).fill(0.1);
    (ollamaEmbed as jest.Mock).mockResolvedValue(
      makeOllamaEmbeddingResponse([vector]),
    );

    const { generateEmbedding: gen } = await import("./embeddings");
    const result1 = await gen("cache test", mockUserId);
    const result2 = await gen("cache test", mockUserId);

    expect(result1).toEqual(vector);
    expect(result2).toEqual(vector);
    // Ollama and DB should only be queried once
    expect(ollamaEmbed).toHaveBeenCalledTimes(1);
    expect(mockSupabase.select).toHaveBeenCalledTimes(1);
  });

  it("implements strict LRU cache eviction when cache limit is exceeded", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const { generateEmbedding: gen } = await import("./embeddings");

    const vector = Array(768).fill(0.1);
    (ollamaEmbed as jest.Mock).mockResolvedValue(
      makeOllamaEmbeddingResponse([vector]),
    );

    // Generate 512 embeddings to fill the L1 cache
    for (let i = 1; i <= 512; i++) {
      await gen(`text ${i}`, mockUserId);
    }

    expect(ollamaEmbed).toHaveBeenCalledTimes(512);
    jest.clearAllMocks();

    // Access "text 1" again. It should be a cache hit and move to the end (MRU)
    await gen("text 1", mockUserId);
    expect(ollamaEmbed).not.toHaveBeenCalled();

    // Generate a new entry "text 513" to trigger eviction
    await gen("text 513", mockUserId);

    jest.clearAllMocks();

    // "text 1" should still be in cache because it was recently accessed
    await gen("text 1", mockUserId);
    expect(ollamaEmbed).not.toHaveBeenCalled();

    // "text 2" should be evicted because it was the least recently used
    await gen("text 2", mockUserId);
    expect(ollamaEmbed).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// batchGenerateEmbeddings
// ---------------------------------------------------------------------------

describe("batchGenerateEmbeddings", () => {
  it("returns empty array for empty input without calling API", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const { batchGenerateEmbeddings: batch } = await import("./embeddings");
    const result = await batch([], mockUserId);
    expect(result).toEqual([]);
    expect(ollamaEmbed).not.toHaveBeenCalled();
  });

  it("returns batch embeddings from Ollama and caches them", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const vectors = [Array(768).fill(0.1), Array(768).fill(0.2)];
    (ollamaEmbed as jest.Mock).mockResolvedValue(
      makeOllamaEmbeddingResponse(vectors),
    );
    mockSupabase.in.mockResolvedValue({ data: [], error: null });

    const { batchGenerateEmbeddings: batch } = await import("./embeddings");
    const result = await batch(["text one", "text two"], mockUserId);

    expect(result).toEqual(vectors);
    expect(ollamaEmbed).toHaveBeenCalledWith(
      ["text one", "text two"],
      expect.objectContaining({ model: "nomic-embed-text:latest" }),
    );
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  it("uses DB cache (L2) for hit entries and Ollama only for misses", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const cachedVector = Array(768).fill(0.3);
    const freshVector = Array(768).fill(0.4);

    (ollamaEmbed as jest.Mock).mockResolvedValue(
      makeOllamaEmbeddingResponse([freshVector]),
    );

    // Mock L2 DB cache hitting for the first text (SHA-256 of "text cached")
    mockSupabase.in.mockResolvedValue({
      data: [
        {
          text_hash:
            "5e016d1372f6bbf5be0d85d936cc454a8479f83df2e5ec370877aca96972abfe",
          embedding: cachedVector,
        },
      ],
      error: null,
    });

    const { batchGenerateEmbeddings: batch } = await import("./embeddings");
    const result = await batch(["text cached", "text fresh"], mockUserId);

    expect(result[0]).toEqual(cachedVector);
    expect(result[1]).toEqual(freshVector);
    expect(ollamaEmbed).toHaveBeenCalledWith(
      ["text fresh"],
      expect.objectContaining({ model: "nomic-embed-text:latest" }),
    );
  });

  it("falls back to individual calls when batch provider fails", async () => {
    const { ollamaEmbed } = jest.requireMock("./ollama");
    const singleVector = Array(768).fill(0.5);
    (ollamaEmbed as jest.Mock)
      .mockRejectedValueOnce(new Error("Batch failed"))
      .mockResolvedValue(makeOllamaEmbeddingResponse([singleVector]));

    mockSupabase.in.mockResolvedValue({ data: [], error: null });
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { batchGenerateEmbeddings: batch } = await import("./embeddings");
    const result = await batch(["text a", "text b"], mockUserId);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(singleVector);
    expect(result[1]).toEqual(singleVector);
  });
});
