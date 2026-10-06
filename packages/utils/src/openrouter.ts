/**
 * OpenRouter API Client & Server Tools Engine
 * Provides complete support for OpenRouter's AI endpoints and Server Tools:
 * - openrouter:web_search
 * - openrouter:web_fetch
 * - openrouter:datetime
 * - openrouter:image_generation
 * - openrouter:apply_patch
 * - openrouter:shell
 * - openrouter:bash
 * - openrouter:fusion
 * - openrouter:advisor
 * - openrouter:subagent
 * - openrouter:experimental__search_models
 * - openrouter:tool_search
 * - openrouter:files
 *
 * Full documentation: https://openrouter.ai/docs/guides/features/server-tools
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const BASE_URL = 'https://openrouter.ai/api/v1';

export type OpenRouterServerToolType =
  | 'openrouter:web_search'
  | 'openrouter:web_fetch'
  | 'openrouter:datetime'
  | 'openrouter:image_generation'
  | 'openrouter:apply_patch'
  | 'openrouter:shell'
  | 'openrouter:bash'
  | 'openrouter:fusion'
  | 'openrouter:advisor'
  | 'openrouter:subagent'
  | 'openrouter:experimental__search_models'
  | 'openrouter:tool_search'
  | 'openrouter:files';

export interface OpenRouterServerTool {
  type: OpenRouterServerToolType;
  parameters?: Record<string, any>;
}

export interface OpenRouterFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
  defer_loading?: boolean;
}

export type OpenRouterTool = OpenRouterServerTool | OpenRouterFunctionTool;

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_call_id?: string;
}

export interface OpenRouterStopCondition {
  type: 'step_count' | 'spend_cap' | 'tool_name' | string;
  value: any;
}

export interface OpenRouterCacheOptions {
  enabled?: boolean;
  ttl?: number; // 1-86400 seconds, default 300
  clear?: boolean; // force cache refresh
}

export interface OpenRouterJsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, any>;
}

export type OpenRouterResponseFormat =
  | { type: 'json_schema'; json_schema: OpenRouterJsonSchema }
  | { type: 'json_object' }
  | { type: 'text' };

export interface OpenRouterEndpointMetadata {
  provider: string;
  model: string;
  selected?: boolean;
}

export interface OpenRouterPipelineStage {
  type:
    | 'guardrail'
    | 'plugin'
    | 'server_tools'
    | 'response_healing'
    | 'context_compression'
    | string;
  name: string;
  guardrail_id?: string;
  summary?: string;
  data?: Record<string, any>;
}

export interface OpenRouterMetadata {
  requested?: string;
  strategy?: string;
  region?: string | null;
  summary?: string;
  attempt?: number;
  is_byok?: boolean;
  endpoints?: {
    total?: number;
    available?: OpenRouterEndpointMetadata[];
  };
  attempts?: Array<{ provider: string; model: string; status: number }>;
  pipeline?: OpenRouterPipelineStage[];
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: OpenRouterTool[];
  tool_choice?:
    | 'auto'
    | 'none'
    | 'required'
    | { type: 'allowed_tools'; tools: string[] }
    | Record<string, any>;
  max_tool_calls?: number; // Outer agent loop step budget (default 30, max 30)
  stop_server_tools_when?: OpenRouterStopCondition[];
  plugins?: Array<{ id: string; enabled?: boolean; [key: string]: any }>;
  provider?: {
    order?: string[];
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: 'deny' | 'allow';
    zdr?: boolean;
  };
  response_format?: OpenRouterResponseFormat;
  cache?: boolean | OpenRouterCacheOptions;
  metadata?: boolean; // When true, sends X-OpenRouter-Metadata: enabled
  stream?: boolean;
}

export interface OpenRouterServerToolUseUsage {
  web_search_requests?: number;
  web_fetch_requests?: number;
  image_generations?: number;
  subagent_runs?: number;
  fusion_runs?: number;
  [key: string]: any;
}

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  server_tool_use?: OpenRouterServerToolUseUsage;
}

export interface OpenRouterChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: OpenRouterUsage;
  openrouter_metadata?: OpenRouterMetadata;
  cache_status?: 'HIT' | 'MISS';
  cache_age?: number;
  cache_ttl?: number;
  cache_source_id?: string;
}

/**
 * Standard Presets for OpenRouter Server Tools
 */
export const OPENROUTER_SERVER_TOOLS = {
  WEB_SEARCH: (parameters?: {
    max_results?: number;
    search_prompt?: string;
    engine?: 'auto' | 'native' | 'exa' | 'parallel' | 'perplexity' | 'firecrawl';
  }): OpenRouterServerTool => ({
    type: 'openrouter:web_search',
    parameters,
  }),
  WEB_FETCH: (parameters?: {
    engine?: 'auto' | 'native' | 'exa' | 'parallel' | 'firecrawl' | 'openrouter';
    max_length?: number;
  }): OpenRouterServerTool => ({
    type: 'openrouter:web_fetch',
    parameters,
  }),
  DATETIME: (parameters?: { timezone?: string }): OpenRouterServerTool => ({
    type: 'openrouter:datetime',
    parameters,
  }),
  IMAGE_GENERATION: (parameters?: {
    aspect_ratio?: string;
    image_model?: string;
  }): OpenRouterServerTool => ({
    type: 'openrouter:image_generation',
    parameters,
  }),
  APPLY_PATCH: (parameters?: {
    engine?: 'auto' | 'native' | 'openrouter';
  }): OpenRouterServerTool => ({
    type: 'openrouter:apply_patch',
    parameters,
  }),
  SHELL: (parameters?: Record<string, any>): OpenRouterServerTool => ({
    type: 'openrouter:shell',
    parameters,
  }),
  BASH: (parameters?: { execution?: 'client' | 'openrouter' }): OpenRouterServerTool => ({
    type: 'openrouter:bash',
    parameters,
  }),
  FUSION: (parameters?: {
    models?: string[];
    max_tool_calls?: number;
    analyst_model?: string;
  }): OpenRouterServerTool => ({
    type: 'openrouter:fusion',
    parameters,
  }),
  ADVISOR: (parameters?: { model?: string; prompt?: string }): OpenRouterServerTool => ({
    type: 'openrouter:advisor',
    parameters,
  }),
  SUBAGENT: (parameters?: {
    model?: string;
    max_tool_calls?: number;
    prompt?: string;
  }): OpenRouterServerTool => ({
    type: 'openrouter:subagent',
    parameters,
  }),
  SEARCH_MODELS: (): OpenRouterServerTool => ({
    type: 'openrouter:experimental__search_models',
  }),
  TOOL_SEARCH: (parameters?: { max_results?: number }): OpenRouterServerTool => ({
    type: 'openrouter:tool_search',
    parameters,
  }),
  FILES: (parameters?: Record<string, any>): OpenRouterServerTool => ({
    type: 'openrouter:files',
    parameters,
  }),
};

/**
 * Perform a chat completion request to OpenRouter with full Server Tools, Caching, and Metadata support.
 * @param request Payload containing model, messages, tools, and configurations.
 */
export async function createChatCompletion(
  request: OpenRouterChatRequest
): Promise<OpenRouterChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment or .env.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://arch-system.local',
    'X-Title': 'Arch-System AI',
  };

  // Response Caching headers
  if (request.cache === true) {
    headers['X-OpenRouter-Cache'] = 'true';
  } else if (typeof request.cache === 'object') {
    if (request.cache.enabled !== false) {
      headers['X-OpenRouter-Cache'] = 'true';
    } else {
      headers['X-OpenRouter-Cache'] = 'false';
    }
    if (typeof request.cache.ttl === 'number') {
      headers['X-OpenRouter-Cache-TTL'] = String(request.cache.ttl);
    }
    if (request.cache.clear) {
      headers['X-OpenRouter-Cache-Clear'] = 'true';
    }
  } else if (request.cache === false) {
    headers['X-OpenRouter-Cache'] = 'false';
  }

  // Router Metadata header
  if (request.metadata) {
    headers['X-OpenRouter-Metadata'] = 'enabled';
  }

  const { cache: _c, metadata: _m, ...requestBody } = request;

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API Error (${response.status}): ${errorBody}`);
  }

  const result = (await response.json()) as OpenRouterChatResponse;

  // Capture response cache telemetry
  const cacheStatus = response.headers.get('x-openrouter-cache-status') as 'HIT' | 'MISS' | null;
  const cacheAge = response.headers.get('x-openrouter-cache-age');
  const cacheTtl = response.headers.get('x-openrouter-cache-ttl');
  const cacheSourceId = response.headers.get('x-openrouter-cache-source-id');

  if (cacheStatus) result.cache_status = cacheStatus;
  if (cacheAge) result.cache_age = parseInt(cacheAge, 10);
  if (cacheTtl) result.cache_ttl = parseInt(cacheTtl, 10);
  if (cacheSourceId) result.cache_source_id = cacheSourceId;

  return result;
}

/**
 * Helper to execute a query with web search server tool enabled
 */
export async function queryWithWebSearch(
  model: string,
  userPrompt: string,
  options: { systemPrompt?: string; maxResults?: number } = {}
): Promise<string> {
  const messages: OpenRouterMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const result = await createChatCompletion({
    model,
    messages,
    tools: [
      OPENROUTER_SERVER_TOOLS.WEB_SEARCH({ max_results: options.maxResults || 5 }),
      OPENROUTER_SERVER_TOOLS.DATETIME(),
    ],
  });

  return result.choices[0]?.message?.content || '';
}

/**
 * Helper to consult an advisor model mid-generation
 */
export async function queryWithAdvisor(
  model: string,
  userPrompt: string,
  advisorModel = 'anthropic/claude-3.5-sonnet'
): Promise<string> {
  const result = await createChatCompletion({
    model,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [OPENROUTER_SERVER_TOOLS.ADVISOR({ model: advisorModel })],
  });

  return result.choices[0]?.message?.content || '';
}

/**
 * Helper to run a multi-model fusion analysis
 */
export async function queryWithFusion(
  model: string,
  userPrompt: string,
  panelModels = ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.5-pro']
): Promise<string> {
  const result = await createChatCompletion({
    model,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [OPENROUTER_SERVER_TOOLS.FUSION({ models: panelModels })],
  });

  return result.choices[0]?.message?.content || '';
}

/**
 * Fetch available models from OpenRouter.
 */
export async function getAvailableModels() {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  const response = await fetch(`${BASE_URL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  const response = await fetch(`${BASE_URL}/auth/key`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Query OpenRouter's Tools API to inspect supported server tools and endpoint support
 */
export async function listServerTools() {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  const response = await fetch(`${BASE_URL}/tools`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch server tools catalog: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ============================================================================
 * OpenRouter Responses API (OpenAI-Compatible Stateless Interface)
 * Base URL: https://openrouter.ai/api/v1/responses
 *
 * NOTE: Strictly stateless. Do NOT supply store: true or previous_response_id.
 * ============================================================================
 */

export type OpenRouterResponsesContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; file_url?: string; filename?: string }
  | { type: 'output_text'; text: string; annotations?: any[] };

export type OpenRouterResponsesInputItem =
  | {
      type: 'message';
      role: 'user' | 'assistant' | 'system' | 'developer';
      content: string | OpenRouterResponsesContentPart[];
      id?: string;
      status?: 'completed' | 'in_progress';
    }
  | {
      type: 'function_call';
      id: string;
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: 'function_call_output';
      id?: string;
      call_id: string;
      output: string | OpenRouterResponsesContentPart[];
    };

export interface OpenRouterResponseRequest {
  model: string;
  input: string | OpenRouterResponsesInputItem[];
  instructions?: string;
  reasoning?: {
    effort?: 'minimal' | 'low' | 'medium' | 'high';
  };
  tools?: OpenRouterTool[];
  tool_choice?:
    | 'auto'
    | 'none'
    | 'required'
    | { type: 'function'; name: string }
    | { type: 'allowed_tools'; tools: string[] };
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  cache?: boolean | OpenRouterCacheOptions;
  metadata?: boolean;
}

export type OpenRouterResponseOutputItem =
  | {
      type: 'message';
      id: string;
      status: 'completed' | 'in_progress';
      role: 'assistant';
      content: Array<{
        type: 'output_text';
        text: string;
        annotations?: any[];
      }>;
    }
  | {
      type: 'reasoning';
      id: string;
      encrypted_content?: string;
      summary?: string[];
    }
  | {
      type: 'function_call';
      id: string;
      call_id: string;
      name: string;
      arguments: string;
    };

export interface OpenRouterResponseResult {
  id: string;
  object: 'response';
  created_at: number;
  model: string;
  output: OpenRouterResponseOutputItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
    total_tokens: number;
  };
  status: 'completed' | 'failed' | 'in_progress';
  openrouter_metadata?: OpenRouterMetadata;
  cache_status?: 'HIT' | 'MISS';
  cache_age?: number;
  cache_ttl?: number;
  /**
   * Helper extracting primary text content
   */
  output_text?: string;
  /**
   * Helper extracting parsed function calls
   */
  function_calls?: Array<{
    id: string;
    call_id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
}

/**
 * Creates an inference response using OpenRouter's Responses API.
 * Full conversation history must be supplied in `input` since this endpoint is strictly stateless.
 */
export async function createResponse(
  request: OpenRouterResponseRequest
): Promise<OpenRouterResponseResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment or .env.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://arch-system.local',
    'X-Title': 'Arch-System Responses Client',
  };

  // Response Caching headers
  if (request.cache === true) {
    headers['X-OpenRouter-Cache'] = 'true';
  } else if (typeof request.cache === 'object') {
    if (request.cache.enabled !== false) {
      headers['X-OpenRouter-Cache'] = 'true';
    } else {
      headers['X-OpenRouter-Cache'] = 'false';
    }
    if (typeof request.cache.ttl === 'number') {
      headers['X-OpenRouter-Cache-TTL'] = String(request.cache.ttl);
    }
    if (request.cache.clear) {
      headers['X-OpenRouter-Cache-Clear'] = 'true';
    }
  } else if (request.cache === false) {
    headers['X-OpenRouter-Cache'] = 'false';
  }

  // Router Metadata header
  if (request.metadata) {
    headers['X-OpenRouter-Metadata'] = 'enabled';
  }

  const { cache: _c, metadata: _m, ...requestBody } = request;

  const response = await fetch(`${BASE_URL}/responses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter Responses API Error (${response.status}): ${errorBody}`);
  }

  const result = (await response.json()) as OpenRouterResponseResult;

  // Capture response cache telemetry
  const cacheStatus = response.headers.get('x-openrouter-cache-status') as 'HIT' | 'MISS' | null;
  const cacheAge = response.headers.get('x-openrouter-cache-age');
  const cacheTtl = response.headers.get('x-openrouter-cache-ttl');

  if (cacheStatus) result.cache_status = cacheStatus;
  if (cacheAge) result.cache_age = parseInt(cacheAge, 10);
  if (cacheTtl) result.cache_ttl = parseInt(cacheTtl, 10);

  // Extract first text message for convenient consumption
  const messageItem = result.output?.find(
    (item): item is Extract<OpenRouterResponseOutputItem, { type: 'message' }> =>
      item.type === 'message'
  );
  if (messageItem && Array.isArray(messageItem.content)) {
    const textPart = messageItem.content.find((p) => p.type === 'output_text');
    if (textPart) {
      result.output_text = textPart.text;
    }
  }

  // Extract function calls for convenient consumption
  const functionCalls: Array<{
    id: string;
    call_id: string;
    name: string;
    arguments: Record<string, any>;
  }> = [];
  for (const item of result.output || []) {
    if (item.type === 'function_call') {
      try {
        functionCalls.push({
          id: item.id,
          call_id: item.call_id,
          name: item.name,
          arguments: JSON.parse(item.arguments),
        });
      } catch {
        functionCalls.push({
          id: item.id,
          call_id: item.call_id,
          name: item.name,
          arguments: { raw: item.arguments },
        });
      }
    }
  }
  if (functionCalls.length > 0) {
    result.function_calls = functionCalls;
  }

  return result;
}

/**
 * Convenience helper to execute a query with reasoning effort via Responses API
 */
export async function createReasoningResponse(
  model: string,
  prompt: string,
  effort: 'minimal' | 'low' | 'medium' | 'high' = 'medium'
): Promise<{ text: string; reasoningSummary?: string[]; reasoningTokens?: number }> {
  const result = await createResponse({
    model,
    input: prompt,
    reasoning: {
      effort,
    },
  });

  const reasoningItem = result.output?.find(
    (item): item is Extract<OpenRouterResponseOutputItem, { type: 'reasoning' }> =>
      item.type === 'reasoning'
  );

  return {
    text: result.output_text || '',
    reasoningSummary: reasoningItem?.summary,
    reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens,
  };
}

/**
 * Convenience helper to execute a query with function calling via Responses API
 */
export async function createToolCallingResponse(
  model: string,
  prompt: string,
  tools: OpenRouterTool[],
  toolChoice: 'auto' | 'none' | 'required' | { type: 'function'; name: string } = 'auto'
): Promise<OpenRouterResponseResult> {
  return await createResponse({
    model,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
    tools,
    tool_choice: toolChoice,
  });
}

/**
 * TypeSafe Jev System One Decisions API
 * Endpoint: POST https://openrouter.ai/api/alpha/decisions
 *
 * System One models make fast, structured decisions returning typed choices rather than free-form text.
 * Three primitives:
 * 1. choice: Pick from defined category keys (up to 255 options)
 * 2. score: Ordered scale / rubric position (2 to 10 levels)
 * 3. noul: Yes/no probability (0.0 to 1.0)
 */

export type JevQuestionType = 'choice' | 'score' | 'noul';

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[] | Record<string, string>;
}

export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string } | Record<string, string> | string;
}

export type JevQuestionDefinition = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export interface JevDecisionsRequest {
  model?: string;
  state: string | Record<string, any> | any[];
  questions: Record<string, JevQuestionDefinition>;
  provider?: {
    order?: string[];
    allow_fallbacks?: boolean;
    data_collection?: 'deny' | 'allow';
    [key: string]: any;
  };
}

export interface JevChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  score: number;
  confidence?: number;
  probabilities?: Record<string, number> | number[];
}

export interface JevNoulAnswer {
  type: 'noul';
  noul: number; // 0.0 - 1.0 probability of true
}

export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;

export interface JevDecisionsResponse {
  answers: Record<string, JevAnswer>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    [key: string]: any;
  };
}

export const DECISIONS_API_URL = 'https://openrouter.ai/api/alpha/decisions';

export async function createDecision(
  request: JevDecisionsRequest,
  apiKeyOverride?: string
): Promise<JevDecisionsResponse> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const model = request.model || 'typesafe/jev-1.13';

  // Normalize noul criteria if provided as yes/no to true/false
  const normalizedQuestions: Record<string, any> = {};
  for (const [key, q] of Object.entries(request.questions)) {
    if (
      q.type === 'noul' &&
      q.criteria &&
      typeof q.criteria === 'object' &&
      !Array.isArray(q.criteria)
    ) {
      const crit = q.criteria as Record<string, string>;
      if ('yes' in crit && !('true' in crit)) {
        normalizedQuestions[key] = {
          ...q,
          criteria: {
            true: crit.yes,
            false: crit.no || 'No',
          },
        };
        continue;
      }
    }
    normalizedQuestions[key] = q;
  }

  const payload = {
    model,
    state: request.state,
    questions: normalizedQuestions,
    ...(request.provider ? { provider: request.provider } : {}),
  };

  const response = await fetch(DECISIONS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://arch-system.local',
      'X-Title': 'Arch-System TypeSafe Jev Client',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 404 && errorBody.includes('Filter by Allowed Providers')) {
      throw new Error(
        `OpenRouter Decisions API: 'typesafe' provider is not currently enabled in your account privacy settings. Visit https://openrouter.ai/settings/privacy to allow 'typesafe'. Details: ${errorBody}`
      );
    }
    throw new Error(`OpenRouter Decisions API Error (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as JevDecisionsResponse;
}

/**
 * Convenience helper to route state/tickets across categories using TypeSafe Jev
 */
export async function evaluateSystemOneRouting(
  state: string | Record<string, any>,
  options: Record<string, string>,
  instructions: string = 'Select the most appropriate route or category for the given input.'
): Promise<{ route: string; confidence?: number; probabilities?: Record<string, number> }> {
  const decision = await createDecision({
    state,
    questions: {
      routing: {
        type: 'choice',
        instructions,
        criteria: options,
      },
    },
  });

  const answer = decision.answers?.routing as JevChoiceAnswer | undefined;
  return {
    route: answer?.choice || Object.keys(options)[0] || '',
    confidence: answer?.confidence,
    probabilities: answer?.probabilities,
  };
}

/**
 * Convenience helper to evaluate a binary gate (yes/no) using TypeSafe Jev
 */
export async function evaluateSystemOneGate(
  state: string | Record<string, any>,
  instructions: string,
  criteriaTrue: string,
  criteriaFalse: string
): Promise<{ pass: boolean; probability: number }> {
  const decision = await createDecision({
    state,
    questions: {
      gate: {
        type: 'noul',
        instructions,
        criteria: {
          true: criteriaTrue,
          false: criteriaFalse,
        },
      },
    },
  });

  const answer = decision.answers?.gate as JevNoulAnswer | undefined;
  const prob = typeof answer?.noul === 'number' ? answer.noul : 0.5;
  return {
    pass: prob >= 0.5,
    probability: prob,
  };
}

/**
 * Convenience helper to evaluate an ordered score/rubric (2-10 levels) using TypeSafe Jev
 */
export async function evaluateSystemOneScore(
  state: string | Record<string, any>,
  instructions: string,
  rubric: string[]
): Promise<{ score: number; confidence?: number }> {
  const decision = await createDecision({
    state,
    questions: {
      evaluation: {
        type: 'score',
        instructions,
        criteria: rubric,
      },
    },
  });

  const answer = decision.answers?.evaluation as JevScoreAnswer | undefined;
  return {
    score: typeof answer?.score === 'number' ? answer.score : 0,
    confidence: answer?.confidence,
  };
}

/**
 * OpenRouter Files API Client
 * Base URL: https://openrouter.ai/api/v1/files
 * Manages durable workspace files, documents, and code artifacts.
 */

export interface OpenRouterFile {
  _shape?: string;
  id: string;
  type: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  downloadable?: boolean;
}

export interface OpenRouterFileListResponse {
  _shape?: string;
  data: OpenRouterFile[];
  has_more: boolean;
  first_id?: string | null;
  last_id?: string | null;
  cursor?: string | null;
}

export const FILES_API_URL = 'https://openrouter.ai/api/v1/files';

export async function listOpenRouterFiles(
  limit: number = 50,
  apiKeyOverride?: string
): Promise<OpenRouterFileListResponse> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${FILES_API_URL}?limit=${limit}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter Files API list error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterFileListResponse;
}

export async function getOpenRouterFileMetadata(
  fileId: string,
  apiKeyOverride?: string
): Promise<OpenRouterFile> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${FILES_API_URL}/${fileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter Files API get error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterFile;
}

export async function deleteOpenRouterFile(
  fileId: string,
  apiKeyOverride?: string
): Promise<{ success: boolean; id: string }> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${FILES_API_URL}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter Files API delete error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as any;
  return {
    success: data.type === 'file_deleted',
    id: fileId,
  };
}

export async function uploadOpenRouterFileBuffer(
  content: string | Buffer | Uint8Array,
  filename: string,
  mimeType: string = 'text/plain',
  apiKeyOverride?: string
): Promise<OpenRouterFile> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const blob = new Blob([content as any], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, filename);

  const res = await fetch(FILES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter Files API upload error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterFile;
}

/**
 * ============================================================================
 * Structured Outputs Helper
 * Enforces JSON Schema conforming model outputs with Response Healing and Caching.
 * ============================================================================
 */
export async function createStructuredOutput<T = any>(options: {
  model: string;
  prompt: string;
  schema: Record<string, any>;
  name?: string;
  strict?: boolean;
  systemPrompt?: string;
  cache?: boolean | OpenRouterCacheOptions;
  responseHealing?: boolean;
  contextCompression?: boolean;
  metadata?: boolean;
}): Promise<{
  data: T;
  rawText: string;
  usage?: OpenRouterUsage;
  cached: boolean;
  metadata?: OpenRouterMetadata;
}> {
  const plugins: Array<{ id: string; enabled?: boolean }> = [];
  if (options.responseHealing !== false) {
    plugins.push({ id: 'response-healing' });
  }
  if (options.contextCompression) {
    plugins.push({ id: 'context-compression' });
  }

  const messages: OpenRouterMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const result = await createChatCompletion({
    model: options.model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: options.name || 'structured_output',
        strict: options.strict ?? true,
        schema: options.schema,
      },
    },
    provider: {
      require_parameters: true,
    },
    plugins: plugins.length > 0 ? plugins : undefined,
    cache: options.cache,
    metadata: options.metadata,
  });

  const content = result.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content) as T;

  return {
    data: parsed,
    rawText: content,
    usage: result.usage,
    cached: result.cache_status === 'HIT',
    metadata: result.openrouter_metadata,
  };
}

/**
 * ============================================================================
 * OpenRouter Containers API (Isolated Linux Sandboxes for Shell & Bash)
 * Base URL: https://openrouter.ai/api/v1/containers
 * ============================================================================
 */

export interface OpenRouterContainerFile {
  id: string; // starts with cfile_
  object: 'container.file';
  container_id: string;
  bytes: number;
  created_at: number;
  path: string;
  source: 'user' | 'assistant';
}

export interface OpenRouterContainerFileListResponse {
  object: 'list';
  data: OpenRouterContainerFile[];
  first_id?: string | null;
  last_id?: string | null;
  has_more: boolean;
}

export async function listContainerFiles(
  containerId: string,
  limit: number = 100,
  after?: string,
  apiKeyOverride?: string
): Promise<OpenRouterContainerFileListResponse> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  let url = `${BASE_URL}/containers/${containerId}/files?limit=${limit}`;
  if (after) url += `&after=${after}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter list container files error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterContainerFileListResponse;
}

export async function getContainerFileMetadata(
  containerId: string,
  fileId: string,
  apiKeyOverride?: string
): Promise<OpenRouterContainerFile> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${BASE_URL}/containers/${containerId}/files/${fileId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter get container file error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterContainerFile;
}

export async function getContainerFileContent(
  containerId: string,
  fileId: string,
  apiKeyOverride?: string
): Promise<string> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${BASE_URL}/containers/${containerId}/files/${fileId}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter download container file error (${res.status}): ${errorText}`);
  }

  return await res.text();
}

export async function promoteContainerFile(
  containerId: string,
  fileId: string,
  apiKeyOverride?: string
): Promise<OpenRouterFile> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${BASE_URL}/containers/${containerId}/files/${fileId}/promote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter promote container file error (${res.status}): ${errorText}`);
  }

  return (await res.json()) as OpenRouterFile;
}
