/**
 * LLM-driven tool dispatch with confidence scoring.
 *
 * Replaces the old regex-based keyword matching in gatherContextNode
 * with proper LLM reasoning about which tool (if any) to call.
 *
 * Two-tier approach:
 *   Primary: Ollama native tool-calling API (for models that support it)
 *   Fallback: Ask the LLM for a JSON block with tool + confidence + reason
 *
 * Confidence threshold: 1-2 → don't fire, agent asks for clarification.
 */

import { OLLAMA_URL, DEFAULT_MODEL, OLLAMA_TIMEOUT_MS } from "./ollama";
import { aiTools } from "./tools";
import { systemPrompts } from "./prompts";
import { logError } from "@/lib/errors/error-logger";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ToolDispatchResult {
  /** The tool name to call, or null if no tool should fire */
  tool: string | null;
  /** Arguments for the tool */
  args: Record<string, unknown>;
  /** Confidence 1-5 (1-2 = don't fire, ask user) */
  confidence: number;
  /** Brief explanation from the LLM about its reasoning */
  reason: string;
}

interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tool definitions in Ollama's native format
// ────────────────────────────────────────────────────────────────────────────

function buildToolDefinitions(): OllamaToolDefinition[] {
  return Object.entries(aiTools).map(([name, tool]) => ({
    type: "function" as const,
    function: {
      name,
      description: tool.description ?? "",
      parameters: {
        type: "object",
        properties: (tool.inputSchema as any)?.shape
          ? Object.fromEntries(
              Object.entries((tool.inputSchema as any).shape).map(
                ([key, schema]: [string, any]) => [
                  key,
                  {
                    type: schema._def?.typeName?.includes("string")
                      ? "string"
                      : "string",
                    description: schema._def?.description ?? "",
                  },
                ],
              ),
            )
          : {},
        required: (tool.inputSchema as any)?.shape
          ? Object.entries((tool.inputSchema as any).shape)
              .filter(([, schema]: [string, any]) => !schema.isOptional?.())
              .map(([key]) => key)
          : [],
      },
    },
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Primary: Ollama native tool calling
// ────────────────────────────────────────────────────────────────────────────

async function tryOllamaNativeDispatch(
  messageText: string,
): Promise<ToolDispatchResult | null> {
  const tools = buildToolDefinitions();

  const body = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompts.toolDispatch },
      { role: "user", content: messageText },
    ],
    tools,
    stream: false,
    options: { temperature: 0.1, num_predict: 512 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Check if Ollama returned a tool call natively
    const toolCalls = data.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0];
      const toolName = call.function?.name;
      if (toolName && aiTools[toolName as keyof typeof aiTools]) {
        let args: Record<string, unknown> = {};
        try {
          args =
            typeof call.function.arguments === "string"
              ? JSON.parse(call.function.arguments)
              : (call.function.arguments ?? {});
        } catch {
          args = {};
        }
        return {
          tool: toolName,
          args,
          confidence: 5, // native tool calls are structurally certain
          reason: "Ollama native function call matched a tool",
        };
      }
    }

    // No native tool call — fall through to JSON fallback
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fallback: JSON block parsing with confidence
// ────────────────────────────────────────────────────────────────────────────

async function tryJsonFallbackDispatch(
  messageText: string,
): Promise<ToolDispatchResult | null> {
  const body = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompts.toolDispatch },
      { role: "user", content: messageText },
    ],
    stream: false,
    options: { temperature: 0.1, num_predict: 512 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.message?.content ?? "";

    // Extract JSON block — tolerate markdown fences or raw JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields with defaults
    const tool = parsed.tool ?? null;
    const confidence =
      typeof parsed.confidence === "number" ? parsed.confidence : 5;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    const args: Record<string, unknown> =
      parsed.args && typeof parsed.args === "object" ? parsed.args : {};

    // Validate tool name
    if (tool !== null && !aiTools[tool as keyof typeof aiTools]) {
      return {
        tool: null,
        args: {},
        confidence: 1,
        reason: `LLM requested unknown tool "${tool}"`,
      };
    }

    return { tool, args, confidence, reason };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Use the LLM to decide which tool to call based on the user's message.
 *
 * Returns null if the dispatch system itself failed (network, parse error),
 * or a ToolDispatchResult with confidence 1-5.
 *
 * The caller should:
 *   - confidence >= 3: execute the tool
 *   - confidence <= 2: route to a clarifying question instead
 *   - tool === null && confidence >= 3: no tool needed, answer directly
 *   - tool === null && confidence <= 2: ambiguous, ask user
 */
export async function dispatchTool(
  messageText: string,
): Promise<ToolDispatchResult | null> {
  if (!messageText?.trim()) return null;

  // Try Ollama native tool calling first (supports Llama 3.1, Mistral, etc.)
  const native = await tryOllamaNativeDispatch(messageText);
  if (native) return native;

  // Fallback: JSON block parsing with confidence
  const fallback = await tryJsonFallbackDispatch(messageText);
  if (fallback) return fallback;

  // Both methods failed — return a safe default
  logError(new Error("Tool dispatch: both native and fallback failed"), {
    context: "tool_dispatch",
  });
  return null;
}

/**
 * Format tools as a string for inclusion in the chat system prompt
 * when tool dispatch should be conversational (not via the router).
 */
export function formatToolDescriptions(): string {
  return Object.entries(aiTools)
    .map(([name, tool]) => {
      const schema = tool.inputSchema as any;
      const params = schema?.shape
        ? Object.keys(schema.shape).join(", ")
        : "none";
      return `- ${name}(${params}): ${tool.description ?? ""}`;
    })
    .join("\n");
}
