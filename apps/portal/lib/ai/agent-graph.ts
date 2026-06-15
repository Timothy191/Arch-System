/**
 * Agent Graph — Explicit state machine for AI chat orchestration.
 *
 * Nodes: authenticate → rateLimit → resolveContext → loadMemory → gatherContext → executeTools → callLLM → output → saveMemory
 *
 * Changes from regex-based dispatch:
 *   - gatherContextNode now uses LLM-driven tool dispatch with confidence scoring
 *   - executeToolsNode uses an in-memory LRU cache with 5s TTL
 *   - callLLMNode retries with jittered backoff on transient errors
 *   - outputNode attaches session ID header for traceability
 *
 * Each node is a pure function: (state) => partialStateUpdate.
 * The router runs nodes sequentially and handles the flow graph.
 */

import { systemPrompts } from "./prompts";
import { createServerSupabaseClient } from "@repo/supabase/server";
import {
  storeMemory,
  retrieveRelevantMemories,
  formatMemoriesForContext,
} from "./memory";
import { withSpan } from "@repo/supabase";
import { logError } from "@/lib/errors/error-logger";
import { checkRateLimit, checkRateLimitForCategory } from "./rate-limiter";
import { ollamaChatStream, DEFAULT_MODEL, type OllamaMessage } from "./ollama";
import { aiTools } from "./tools";
import { dispatchTool } from "./tool-dispatch";
import { getCachedToolResult, setCachedToolResult } from "./tool-cache";
import type {
  AgentState,
  AgentNodeName,
  AgentContext,
  LLMResponse,
} from "./agent-state";
import { reduceState } from "./agent-state";

// ============================================================================
// Constants
// ============================================================================

/** Retry a transient Ollama failure at most once with jittered backoff. */
const MAX_LLM_RETRIES = 1;
const RETRY_BACKOFF_MIN_MS = 200;
const RETRY_BACKOFF_MAX_MS = 500;

/**
 * Per-tool cache TTLs (milliseconds).
 * Slow-changing data gets a longer TTL to reduce redundant Supabase queries.
 * Fast-changing data gets a short TTL to maintain freshness.
 */
const TOOL_CACHE_TTL: Record<string, number> = {
  machineStatus: 15_000, // 15s — statuses can change minute-to-minute
  fleetStatus: 30_000, // 30s — fleet ops change more slowly
  shiftLogs: 60_000, // 60s — historical log data is static
  delays: 15_000, // 15s — delays can be resolved at any time
};

// ============================================================================
// Helpers
// ============================================================================

function getMessageText(msg: AgentState["messages"][number]): string {
  if ("content" in msg && typeof msg.content === "string") {
    return msg.content;
  }
  const textPart = msg.parts?.find((p: { type: string }) => p.type === "text");
  return textPart?.text ?? "";
}

/**
 * Check whether an error is transient (connection refused, timeout, 5xx)
 * and worth retrying vs. a permanent error (400, 401, malformed request).
 */
function isTransientError(error: unknown): boolean {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    return (
      statusCode === 502 ||
      statusCode === 504 ||
      statusCode === 503 ||
      statusCode === 429
    );
  }
  if (error instanceof TypeError) {
    // fetch() throws TypeError on network failures (connection refused, DNS, etc.)
    return true;
  }
  const msg = String(error);
  return (
    msg.includes("timed out") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    msg.includes("socket hang up")
  );
}

function jitteredBackoff(): Promise<void> {
  const delay =
    Math.random() * (RETRY_BACKOFF_MAX_MS - RETRY_BACKOFF_MIN_MS) +
    RETRY_BACKOFF_MIN_MS;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// Node implementations
// ============================================================================

async function authenticateNode(
  _state: AgentState,
): Promise<Partial<AgentState>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Unauthorized",
      statusCode: 401,
      shouldContinue: false,
      nextNode: "END",
    };
  }

  return { nextNode: "rateLimit" };
}

async function rateLimitNode(state: AgentState): Promise<Partial<AgentState>> {
  const allowed = await checkRateLimit(state.ip);
  if (!allowed) {
    return {
      error: "Rate limited",
      statusCode: 429,
      shouldContinue: false,
      nextNode: "END",
    };
  }
  return { nextNode: "resolveContext" };
}

async function resolveContextNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const supabase = await createServerSupabaseClient();

  // Resolve department from context string if present
  const deptName = state.context?.toLowerCase().split(" ")[0];
  if (!deptName) {
    return { agentContext: {}, nextNode: "loadMemory" };
  }

  try {
    const { data: dept } = await supabase
      .from("departments")
      .select("id, name")
      .eq("name", deptName)
      .single();

    if (!dept) {
      return { agentContext: {}, nextNode: "loadMemory" };
    }

    const context: AgentContext = {
      departmentName: dept.name,
      departmentId: dept.id,
    };

    return { agentContext: context, nextNode: "loadMemory" };
  } catch {
    return { agentContext: {}, nextNode: "loadMemory" };
  }
}

async function loadMemoryNode(state: AgentState): Promise<Partial<AgentState>> {
  const latestUserMessage = [...state.messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!latestUserMessage) {
    return { memoryContext: "", nextNode: "gatherContext" };
  }

  const messageText = getMessageText(latestUserMessage);

  try {
    await storeMemory({
      sessionId: state.sessionId,
      userId: state.userId,
      content: `User: ${messageText}`,
      memoryType: "episodic",
      metadata: {
        message_id: latestUserMessage.id,
        role: "user",
        ip: state.ip,
      },
    });

    // Retrieve memories in parallel
    const [sessionMemories, semanticMemories] = await Promise.all([
      retrieveRelevantMemories({
        userId: state.userId,
        query: messageText,
        sessionId: state.sessionId,
        memoryType: "episodic",
        limit: 10,
        useHybridSearch: true,
      }).catch(() => []),
      retrieveRelevantMemories({
        userId: state.userId,
        query: messageText,
        memoryType: "semantic",
        limit: 5,
        useHybridSearch: true,
      }).catch(() => []),
    ]);

    const combinedMemories = [...sessionMemories, ...semanticMemories]
      .sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0))
      .slice(0, 10);

    const memoryContext = formatMemoriesForContext(combinedMemories);

    return {
      memoryContext,
      userMessageStored: true,
      nextNode: "gatherContext",
    };
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "agent_graph_load_memory",
    });
    return { memoryContext: "", nextNode: "gatherContext" };
  }
}

/**
 * LLM-driven tool dispatch (replaces old regex keyword matching).
 *
 * Uses the LLM to decide which tool to call with a confidence score.
 * High confidence (>= 3) → execute the tool.
 * Low confidence (1-2) → route to clarifying path.
 * No tool needed → skip straight to callLLM.
 */
async function gatherContextNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const latestUserMessage = [...state.messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!latestUserMessage) {
    return { nextNode: "callLLM" };
  }

  const text = getMessageText(latestUserMessage);
  if (!text?.trim()) {
    return { nextNode: "callLLM" };
  }

  // Ask the LLM which tool (if any) to call
  const dispatch = await dispatchTool(text);

  // If the dispatch system itself failed, answer directly
  if (!dispatch) {
    return { nextNode: "callLLM" };
  }

  // Low confidence → route to clarifying path
  if (dispatch.confidence <= 2) {
    // Inject a clarification message into context rather than calling a tool.
    // The LLM will see this and ask the user what they meant.
    const clarificationMsg = `The user's intent is ambiguous (confidence: ${dispatch.confidence}/5, reason: "${dispatch.reason}"). Respond by asking a clarifying question rather than guessing which tool to use.`;
    return {
      context: (state.context ?? "") + "\n\n" + clarificationMsg,
      nextNode: "callLLM",
    };
  }

  // No tool needed but intent is clear — answer directly
  if (dispatch.tool === null) {
    return { nextNode: "callLLM" };
  }

  // Valid tool with sufficient confidence — execute it
  return {
    toolCalls: [{ tool: dispatch.tool, args: dispatch.args }],
    nextNode: "executeTools",
  };
}

async function executeToolsNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  if (!state.toolCalls || state.toolCalls.length === 0) {
    return { nextNode: "callLLM" };
  }

  const results: unknown[] = [];
  let toolContext = "Operational Data Summary:\n";

  for (const call of state.toolCalls as any[]) {
    // Per-tool rate limit
    if (state.ip) {
      const allowed = await checkRateLimitForCategory(
        "tool",
        state.ip,
        call.tool,
      );
      if (!allowed) {
        results.push({
          tool: call.tool,
          result: { error: `Rate limit exceeded for tool ${call.tool}` },
        });
        toolContext += `\n[Tool: ${call.tool}]\n${JSON.stringify({ error: `Rate limit exceeded for tool ${call.tool}` })}\n`;
        continue;
      }
    }

    try {
      const tool = aiTools[call.tool as keyof typeof aiTools];
      if (!tool) continue;

      // Check cache with per-tool TTL
      const cached = getCachedToolResult(call.tool, call.args);
      if (cached !== undefined) {
        results.push({ tool: call.tool, result: cached });
        toolContext += `\n[Tool: ${call.tool} (cached)]\n${JSON.stringify(cached, null, 2)}\n`;
        continue;
      }

      // Execute and cache with tool-specific TTL
      const result = await tool.execute(call.args);
      const ttl = TOOL_CACHE_TTL[call.tool] ?? 5_000;
      setCachedToolResult(call.tool, call.args, result, ttl);

      results.push({ tool: call.tool, result });
      toolContext += `\n[Tool: ${call.tool}]\n${JSON.stringify(result, null, 2)}\n`;
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: `agent_tool_exec_${call.tool}`,
      });
    }
  }

  return {
    toolResults: results,
    context: (state.context ?? "") + "\n\n" + toolContext,
    nextNode: "callLLM",
  };
}

/**
 * Calls the LLM with retry logic for transient errors.
 *
 * - Produces a streaming Response via SSE (same format as before).
 * - On transient failure (connection refused, timeout, 5xx):
 *   retries once with temperature: 0 after jittered backoff.
 * - On permanent failure: returns error state immediately.
 */
async function callLLMNode(state: AgentState): Promise<Partial<AgentState>> {
  const systemPrompt = systemPrompts.chat(
    state.context ?? "",
    state.memoryContext ?? "",
  );

  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...state.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: getMessageText(m),
      })),
  ];

  async function attempt(retryIndex: number): Promise<Partial<AgentState>> {
    const temperature = retryIndex > 0 ? 0 : 0.7;

    try {
      const streamGen = await ollamaChatStream(messages, {
        model: state.selectedModel ?? DEFAULT_MODEL,
        temperature,
        maxTokens: 4096,
      });

      let fullText = "";
      let resolveText: (_value: string) => void;
      const textPromise = new Promise<string>((resolve) => {
        resolveText = resolve;
      });

      const iterator = streamGen[Symbol.asyncIterator]();

      const streamResponse = new Response(
        new ReadableStream({
          async pull(controller) {
            try {
              const { value, done } = await iterator.next();
              if (done) {
                resolveText(fullText);
                controller.close();
                return;
              }
              if (value) {
                fullText += value;
                controller.enqueue(new TextEncoder().encode(`0: ${value}\n`));
              }
            } catch (err) {
              resolveText(fullText);
              controller.error(
                err instanceof Error ? err : new Error(String(err)),
              );
            }
          },
          cancel() {
            resolveText(fullText);
            iterator.return?.();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );

      const result: LLMResponse = {
        text: textPromise,
        usage: Promise.resolve({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }),
        toUIMessageStreamResponse: () => streamResponse,
      };

      return { llmResponse: result, nextNode: "output" };
    } catch (error) {
      // Retry on transient errors only
      if (retryIndex < MAX_LLM_RETRIES && isTransientError(error)) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          context: `agent_graph_call_llm_retry_${retryIndex + 1}`,
        });
        await jitteredBackoff();
        return attempt(retryIndex + 1);
      }

      // Permanent or unrecoverable
      logError(error instanceof Error ? error : new Error(String(error)), {
        context: "agent_graph_call_llm",
        retries: retryIndex,
      });
      return {
        error: "Failed to generate response",
        statusCode: 500,
        shouldContinue: false,
        nextNode: "END",
      };
    }
  }

  return attempt(0);
}

async function saveMemoryNode(state: AgentState): Promise<Partial<AgentState>> {
  if (state.assistantResponseStored || !state.llmResponse) {
    return { nextNode: "END" };
  }

  try {
    const text = await state.llmResponse.text;

    if (text.trim().length > 0) {
      await storeMemory({
        sessionId: state.sessionId,
        userId: state.userId,
        content: `Assistant: ${text}`,
        memoryType: "episodic",
        metadata: { role: "assistant", provider: state.provider },
      });
    }

    return { assistantResponseStored: true, nextNode: "END" };
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "agent_graph_save_memory",
    });
    return { nextNode: "END" };
  }
}

/**
 * Wraps the streaming Response with a session ID header for
 * serverless-safe memory handshake. The client echoes this header
 * on the next request so the server can finalize pending memory saves.
 */
async function outputNode(state: AgentState): Promise<Partial<AgentState>> {
  if (!state.llmResponse) {
    return {
      error: "No LLM response available",
      statusCode: 500,
      shouldContinue: false,
      nextNode: "END",
    };
  }

  try {
    const streamResponse = state.llmResponse.toUIMessageStreamResponse();

    // Attach session ID header for debugging and tracing.
    const response = new Response(streamResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "x-arch-session-id": state.sessionId,
      },
    });

    return {
      streamResponse: response,
      shouldContinue: false,
      nextNode: "saveMemory",
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "agent_graph_output",
    });
    return {
      error: "Failed to stream response",
      statusCode: 500,
      shouldContinue: false,
      nextNode: "END",
    };
  }
}

// ============================================================================
// Graph Router
// ============================================================================

function wrapNode(
  name: AgentNodeName,
  node: (_state: AgentState) => Promise<Partial<AgentState>>,
): (_state: AgentState) => Promise<Partial<AgentState>> {
  return (state: AgentState) =>
    withSpan(`agent.node.${name}`, () => node(state), { node: name });
}

const NODE_MAP: Record<
  AgentNodeName,
  ((_state: AgentState) => Promise<Partial<AgentState>>) | null
> = {
  authenticate: wrapNode("authenticate", authenticateNode),
  rateLimit: wrapNode("rateLimit", rateLimitNode),
  resolveContext: wrapNode("resolveContext", resolveContextNode),
  loadMemory: wrapNode("loadMemory", loadMemoryNode),
  gatherContext: wrapNode("gatherContext", gatherContextNode),
  callLLM: wrapNode("callLLM", callLLMNode),
  executeTools: wrapNode("executeTools", executeToolsNode),
  saveMemory: wrapNode("saveMemory", saveMemoryNode),
  output: wrapNode("output", outputNode),
  END: null,
};

/**
 * Execute the agent graph.
 *
 * Returns either a streaming Response (with session ID header) or an error Response.
 * After returning a stream, the caller should invoke finalizeAgentGraph
 * to persist the assistant response wherever possible (waitUntil vs. header handshake).
 */
export async function runAgentGraph(
  initialState: AgentState,
): Promise<{ response: Response; finalState: AgentState }> {
  return withSpan(
    "agent.graph.run",
    async () => {
      let state = initialState;

      while (state.shouldContinue && state.nextNode !== "END") {
        const node = NODE_MAP[state.nextNode];
        if (!node) break;

        const update = await node(state);
        state = reduceState(state, update);
      }

      if (state.error) {
        const response = new Response(JSON.stringify({ error: state.error }), {
          status: state.statusCode ?? 500,
          headers: { "Content-Type": "application/json" },
        });
        return { response, finalState: state };
      }

      if (!state.streamResponse) {
        const response = new Response(
          JSON.stringify({ error: "No response generated" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
        return { response, finalState: state };
      }

      return { response: state.streamResponse, finalState: state };
    },
    { sessionId: initialState.sessionId, provider: initialState.provider },
  );
}

/**
 * Post-stream memory save.
 *
 * Idempotent: saveMemoryNode checks assistantResponseStored.
 * Called from the chat route via waitUntil (platform-supported) or
 * fire-and-forget with an Inngest durable fallback.
 */
export async function finalizeAgentGraph(state: AgentState): Promise<void> {
  if (state.nextNode === "saveMemory" && !state.assistantResponseStored) {
    const update = await saveMemoryNode(state);
    reduceState(state, update);
  }
}
