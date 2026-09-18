import crypto from "node:crypto";
import { APIError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  generateEmbedding(_text: string): Promise<number[]>;
  batchGenerateEmbeddings(_texts: string[]): Promise<number[][]>;
}

/**
 * Deterministic Mock Embedding Provider for offline development,
 * fallback operation, and automated testing.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "mock";
  readonly dimensions: number;

  constructor(dimensions = 768) {
    this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateDeterministicVector(t));
  }

  private generateDeterministicVector(text: string): number[] {
    const hash = crypto.createHash("sha256").update(text).digest();
    const vector: number[] = new Array(this.dimensions);
    let normSq = 0;

    for (let i = 0; i < this.dimensions; i++) {
      const byteVal = hash[i % hash.length] ?? 0;
      // Map byte value [0, 255] to range [-1.0, 1.0]
      const val = (byteVal / 255.5) * 2 - 1 + Math.sin(i + text.length);
      vector[i] = val;
      normSq += val * val;
    }

    // Normalize to unit vector for cosine distance stability
    const norm = Math.sqrt(normSq) || 1;
    return vector.map((v) => v / norm);
  }
}

/**
 * Ollama Embedding Provider (e.g., nomic-embed-text, 768 dimensions)
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    model = "nomic-embed-text",
    dimensions = 768
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
    this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      const data = (await response.json()) as { embedding?: number[] };
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error("Invalid embedding response from Ollama API");
      }

      return data.embedding;
    } catch (err) {
      logError(err, { context: "ollama_embedding_error", model: this.model });
      throw new APIError("Failed to generate embedding via Ollama", {
        statusCode: 503,
        context: { provider: this.name, model: this.model },
      });
    }
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }
}

/**
 * OpenAI Embedding Provider (e.g., text-embedding-3-small, 1536 dimensions)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    apiKey = process.env.OPENAI_API_KEY || "",
    model = "text-embedding-3-small",
    dimensions = 1536
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.batchGenerateEmbeddings([text]);
    const first = results[0];
    if (!first) {
      throw new APIError("No embedding returned from OpenAI", { statusCode: 500 });
    }
    return first;
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new APIError("OpenAI API key missing", { statusCode: 503 });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const data = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
      };

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid embedding payload structure from OpenAI");
      }

      return data.data.map((item) => item.embedding);
    } catch (err) {
      logError(err, { context: "openai_embedding_error", model: this.model });
      throw new APIError("Failed to generate embedding via OpenAI", {
        statusCode: 503,
        context: { provider: this.name, model: this.model },
      });
    }
  }
}

/**
 * Global Embedding Provider Registry
 */
class ProviderRegistry {
  private providers = new Map<string, EmbeddingProvider>();
  private activeProviderName = "mock";

  constructor() {
    this.registerProvider(new MockEmbeddingProvider(768));
  }

  registerProvider(provider: EmbeddingProvider): void {
    this.providers.set(provider.name, provider);
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Embedding provider '${name}' is not registered`);
    }
    this.activeProviderName = name;
  }

  getActiveProvider(): EmbeddingProvider {
    const provider = this.providers.get(this.activeProviderName);
    if (!provider) {
      return new MockEmbeddingProvider(768);
    }
    return provider;
  }
}

export const embeddingProviderRegistry = new ProviderRegistry();
