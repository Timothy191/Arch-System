import { NextRequest } from "next/server";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import {
  ARCH_AGENT_SYSTEM_PROMPT,
  getAgentApiKey,
  getAgentApiUrl,
  getAgentModel,
  isIntegratedAgentReady,
} from "~/lib/agent/config";
import type { AgentMessage } from "~/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ChatRequestBody {
  messages?: Array<Pick<AgentMessage, "role" | "content">>;
}

function sanitizeMessages(messages: ChatRequestBody["messages"]) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

export async function POST(request: NextRequest) {
  if (!isIntegratedAgentReady()) {
    return new Response(
      JSON.stringify({
        error: "Integrated agent is not configured. Set ARCH_AGENT_API_URL and ARCH_AGENT_API_KEY.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "At least one message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(`${getAgentApiUrl().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAgentApiKey()}`,
    },
    body: JSON.stringify({
      model: getAgentModel(),
      stream: true,
      temperature: 0.3,
      messages: [{ role: "system", content: ARCH_AGENT_SYSTEM_PROMPT }, ...messages],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "Agent provider request failed",
        status: upstream.status,
        detail: detail.slice(0, 500),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
