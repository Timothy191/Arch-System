/**
 * OpenRouter API Client
 *
 * This client provides native access to OpenRouter's API, replacing the need
 * for an external service to act as an intermediary for model routing.
 *
 * API Key: Expected via OPENROUTER_API_KEY environment variable,
 * or provided explicitly during initialization.
 */

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stream?: boolean;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";
  private siteUrl: string;
  private siteName: string;

  constructor(config?: { apiKey?: string; siteUrl?: string; siteName?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.siteUrl = config?.siteUrl || process.env.SITE_URL || "http://localhost:3000";
    this.siteName = config?.siteName || process.env.SITE_NAME || "Arch-System";

    if (!this.apiKey) {
      console.warn("OpenRouterClient initialized without an API key.");
    }
  }

  /**
   * Generates a chat completion using the OpenRouter API.
   * @param request The chat completion request payload
   * @returns The JSON response from OpenRouter
   */
  async generateCompletion(request: OpenRouterRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": this.siteUrl,
        "X-Title": this.siteName,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Helper function to get available models.
   */
  async getModels(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
