import { type CopilotGroundingContext, executeOperationsCopilot } from '@repo/intelligence';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchShiftIntelligence, searchSimilarBreakdowns } from '@/lib/ai/mining-rag';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const requestSchema = z.object({
  question: z.string().trim().min(3).max(4_000),
  context: z.record(z.string(), z.unknown()).optional(),
});

const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_COMPLETION_TOKENS = 700;
const COPILOT_TEMPERATURE = 0.2;
const RAG_RESULT_LIMIT = 3;

const SYSTEM_PROMPT = `You are the Arch Systems operations copilot. Give concise, evidence-based guidance for mining operations. Never invent telemetry, permissions, incidents, or actions. Clearly separate observed facts from recommendations. Recommend escalation for safety-critical, compliance, or production-impacting decisions. Do not execute actions; describe the next safe step.`;

async function callProvider(options: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly groundedPrompt: string;
  readonly provider: 'groq' | 'openrouter';
}): Promise<string> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.provider === 'openrouter'
        ? {
            'HTTP-Referer': 'https://arch-system.local',
            'X-Title': 'Arch-System Operations Copilot',
          }
        : {}),
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: options.groundedPrompt },
      ],
      temperature: COPILOT_TEMPERATURE,
      max_tokens: MAX_COMPLETION_TOKENS,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`${options.provider} returned ${response.status}`);
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = result.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error(`${options.provider} returned an empty response`);
  return answer;
}

async function gatherGroundingContext(
  question: string,
  userId: string,
  dashboardContext: Record<string, unknown> | undefined
): Promise<CopilotGroundingContext> {
  const [breakdownResult, shiftNoteResult] = await Promise.allSettled([
    searchSimilarBreakdowns(question, userId, RAG_RESULT_LIMIT),
    searchShiftIntelligence(question, userId, RAG_RESULT_LIMIT),
  ]);

  const breakdownMatches =
    breakdownResult.status === 'fulfilled'
      ? breakdownResult.value.map((match) => ({
          id: match.id,
          fleetId: match.fleetId,
          reason: match.reason,
          repairNotes: match.repairNotes,
          score: match.score,
        }))
      : [];

  const shiftNoteMatches =
    shiftNoteResult.status === 'fulfilled'
      ? shiftNoteResult.value.map((note) => ({
          id: note.id,
          shiftType: note.shiftType,
          noteDate: note.noteDate,
          content: note.content,
          score: note.score,
        }))
      : [];

  return {
    question,
    dashboardContext,
    breakdownMatches,
    shiftNoteMatches,
    fleetPredictions: [],
    telemetryAnomalies: [],
  };
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid copilot request' }, { status: 400 });
  }

  const { question, context } = parsed.data;
  const grounding = await gatherGroundingContext(question, principal.user.id, context);

  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const result = await executeOperationsCopilot({
    grounding,
    llmResponder: async (groundedPrompt) => {
      if (groqKey) {
        const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        try {
          const answer = await callProvider({
            baseUrl: 'https://api.groq.com/openai/v1',
            apiKey: groqKey,
            model,
            groundedPrompt,
            provider: 'groq',
          });
          return { answer, provider: 'groq', model };
        } catch {
          // Fall through to OpenRouter or deterministic fallback.
        }
      }

      if (openRouterKey) {
        const model = 'openrouter/free';
        try {
          const answer = await callProvider({
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: openRouterKey,
            model,
            groundedPrompt,
            provider: 'openrouter',
          });
          return { answer, provider: 'openrouter', model };
        } catch {
          // Fall through to deterministic fallback.
        }
      }

      return null;
    },
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await connection();
  return withRateLimit(request, () => handlePost(request), {
    customLimit: { windowMs: 60_000, maxRequests: 10 },
  });
}
