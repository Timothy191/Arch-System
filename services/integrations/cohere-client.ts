/**
 * Cohere API Client
 *
 * This client provides native access to Cohere's API for features like
 * chat, embeddings, and reranking natively in TypeScript.
 *
 * API Key: Expected via COHERE_API_KEY environment variable.
 */

interface CohereMessage {
  role: "USER" | "CHATBOT" | "SYSTEM";
  message: string;
}

interface CohereChatRequest {
  message: string;
  model?: string;
  stream?: boolean;
  preamble?: string;
  chat_history?: CohereMessage[];
  temperature?: number;
  max_tokens?: number;
}

export class CohereClient {
  private apiKey: string;
  private baseUrl = "https://api.cohere.com/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COHERE_API_KEY || "";

    if (!this.apiKey) {
      console.warn("CohereClient initialized without an API key.");
    }
  }

  /**
   * Generates a chat response using Cohere's Command models.
   * @param request The chat request payload
   * @returns The JSON response from Cohere
   */
  async chat(request: CohereChatRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Generates text embeddings for given inputs.
   */
  async embed(
    texts: string[],
    model: string = "embed-english-v3.0",
    inputType: "search_document" | "search_query" = "search_document"
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        texts,
        model,
        input_type: inputType,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
