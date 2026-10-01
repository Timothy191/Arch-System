/**
 * OpenRouter API Client
 * Provides integration with OpenRouter's AI endpoints.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Perform a chat completion request to OpenRouter.
 * @param request Payload containing model and messages.
 */
export async function createChatCompletion(request: OpenRouterChatRequest) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://arch-system.local', // Required by OpenRouter for ranking
      'X-Title': 'Arch-System AI', // Optional. Site title for rankings
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API Error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Fetch available models from OpenRouter.
 */
export async function getAvailableModels() {
  const response = await fetch(`${BASE_URL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the credit balance for the OpenRouter account.
 */
export async function getAccountCredits() {
  const response = await fetch(`${BASE_URL}/auth/key`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account info: ${response.statusText}`);
  }

  return response.json();
}
