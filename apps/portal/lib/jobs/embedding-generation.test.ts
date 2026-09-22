const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockGenerateEmbedding = jest.fn().mockResolvedValue(undefined);
const mockBatchGenerateEmbeddings = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  batchGenerateEmbeddings: (...args: unknown[]) => mockBatchGenerateEmbeddings(...args),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
  aiGenerateEmbeddingEvent: "ai/generate-embedding",
}));

import { generateEmbeddingFn } from "./embedding-generation";

const handler = (generateEmbeddingFn as any).handler;

describe("generateEmbeddingFn", () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockGenerateEmbedding.mockClear();
    mockBatchGenerateEmbeddings.mockClear();
  });

  it("uses the batch path when texts is an array", async () => {
    const result = await handler({
      event: { data: { texts: ["alpha", "beta"], userId: "u1" } },
    });
    expect(result).toEqual({ success: true });
    expect(mockBatchGenerateEmbeddings).toHaveBeenCalledWith(["alpha", "beta"], "u1");
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
  });

  it("generates a single embedding for non-empty text", async () => {
    const result = await handler({
      event: { data: { text: "hello world", userId: "u1" } },
    });
    expect(result).toEqual({ success: true });
    expect(mockGenerateEmbedding).toHaveBeenCalledWith("hello world", "u1");
    expect(mockBatchGenerateEmbeddings).not.toHaveBeenCalled();
  });

  it("no-ops when text is empty or whitespace", async () => {
    const result = await handler({
      event: { data: { text: "   ", userId: "u1" } },
    });
    expect(result).toEqual({ success: true });
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    expect(mockBatchGenerateEmbeddings).not.toHaveBeenCalled();
  });

  it("logs and re-throws when embedding generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("embedding service unavailable"));

    await expect(handler({ event: { data: { text: "hello", userId: "u1" } } })).rejects.toThrow(
      "embedding service unavailable",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "generate_embedding_job" }),
    );
  });
});
