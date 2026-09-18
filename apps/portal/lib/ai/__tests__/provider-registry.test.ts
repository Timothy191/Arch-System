import { embeddingProviderRegistry, MockEmbeddingProvider } from "../provider-registry";

describe("Embedding Provider Registry", () => {
  it("generates deterministic normalized vectors with MockEmbeddingProvider", async () => {
    const provider = new MockEmbeddingProvider(768);
    expect(provider.dimensions).toBe(768);

    const vec1 = await provider.generateEmbedding("hello world");
    const vec2 = await provider.generateEmbedding("hello world");
    const vec3 = await provider.generateEmbedding("different text");

    expect(vec1).toHaveLength(768);
    expect(vec1).toEqual(vec2);
    expect(vec1).not.toEqual(vec3);

    // Verify unit vector normalization
    const normSq = vec1.reduce((sum, v) => sum + v * v, 0);
    expect(Math.abs(normSq - 1.0)).toBeLessThan(0.0001);
  });

  it("handles batch embedding generation in MockEmbeddingProvider", async () => {
    const provider = new MockEmbeddingProvider(768);
    const results = await provider.batchGenerateEmbeddings(["a", "b", "c"]);

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveLength(768);
    expect(results[1]).toHaveLength(768);
    expect(results[2]).toHaveLength(768);
  });

  it("registers and switches active providers in ProviderRegistry", () => {
    const customMock = new MockEmbeddingProvider(1536);
    embeddingProviderRegistry.registerProvider(customMock);

    expect(embeddingProviderRegistry.getActiveProvider().name).toBe("mock");
  });
});
