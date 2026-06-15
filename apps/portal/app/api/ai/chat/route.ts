import { createServerSupabaseClient } from "@repo/supabase/server";
import { inngest } from "@repo/utils/inngest";
import { logError } from "@/lib/errors/error-logger";
import { createInitialAgentState } from "@/lib/ai/agent-state";
import { runAgentGraph, finalizeAgentGraph } from "@/lib/ai/agent-graph";
import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";
import { aiChatSchema } from "@repo/contract";

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function handleChatRequest(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return applyCors(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return applyCors(
      req,
      NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      ),
    );
  }

  const {
    messages: rawMessages,
    context,
    sessionId: clientSessionId,
    model,
  } = parsed.data;
  const sessionId = clientSessionId ?? generateSessionId();

  const messages = rawMessages.map((m) => ({
    ...m,
    parts: m.parts ?? [],
  }));

  const initialState = createInitialAgentState(
    user.id,
    sessionId,
    ip,
    messages,
    context,
    model,
  );

  try {
    const { response, finalState } = await runAgentGraph(initialState);

    if (finalState.nextNode === "saveMemory") {
      const g = globalThis as any;
      if (typeof g.waitUntil === "function") {
        g.waitUntil(finalizeAgentGraph(finalState));
        return response;
      }

      finalizeAgentGraph(finalState).catch((err: unknown) => {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: "chat_finalize_memory_fallback",
          sessionId,
        });

        const stateSnapshot = {
          sessionId: finalState.sessionId,
          userId: finalState.userId,
          assistantResponseStored: finalState.assistantResponseStored,
        };
        inngest.send({
          name: "ai/memory-persist",
          data: stateSnapshot,
        });
      });
    }

    return response;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "chat_agent_graph_unhandled",
    });
    return applyCors(
      req,
      NextResponse.json(
        { error: "Failed to process request" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: Request) {
  return withBodyLimit(
    req,
    () =>
      withRateLimit(req, () => handleChatRequest(req) as Promise<NextResponse>),
    { maxSize: 1_048_576 },
  );
}
