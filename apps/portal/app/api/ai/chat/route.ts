/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chat with AI assistant
 *     description: Interact with the AI assistant using a multi-turn conversation interface. Supports context passing and session management for coherent conversations.
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - content
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *                     parts:
 *                       type: array
 *                       items:
 *                         type: object
 *                       description: Optional multipart content (images, files)
 *               context:
 *                 type: string
 *                 description: Additional context for the conversation
 *               sessionId:
 *                 type: string
 *                 description: "Session ID for conversation continuity (auto-generated if not provided)"
 *               model:
 *                 type: string
 *                 description: "AI model to use (default: provider default)"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
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
