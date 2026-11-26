import { type CopilotGroundingContext, executeOperationsCopilot } from '@repo/intelligence';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEmbedding } from '@/lib/ai/embeddings';
import {
  searchExternalDocuments,
  searchShiftIntelligence,
  searchSimilarBreakdowns,
} from '@/lib/ai/mining-rag';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';
import { logError } from '@/lib/errors/error-logger';

const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_COMPLETION_TOKENS = 700;
const MAX_ANSWER_WORDS = 180;
const COPILOT_TEMPERATURE = 0;
const RAG_RESULT_LIMIT = 3;
const MIN_GROUNDING_SCORE = 55;
const MAX_EXTERNAL_DOC_SOURCE_CHARS = 1_200;
const MAX_DASHBOARD_CONTEXT_KEYS = 8;
const MAX_DASHBOARD_CONTEXT_VALUE_CHARS = 240;

const SYSTEM_PROMPT = `You are the Arch Operations Copilot. Use only the supplied grounded evidence. If evidence is absent or insufficient, say "not available in retrieved evidence". Separate Observed facts from Recommendations. Never claim an action was executed. Escalate safety-critical or compliance decisions to the shift supervisor. Keep the answer under ${MAX_ANSWER_WORDS} words.`;

const contextSchema = z
  .record(
    z.string(),
    z.union([z.string().max(MAX_DASHBOARD_CONTEXT_VALUE_CHARS), z.number(), z.boolean()])
  )
  .refine((context) => Object.keys(context).length <= MAX_DASHBOARD_CONTEXT_KEYS, {
    message: `Dashboard context is limited to ${MAX_DASHBOARD_CONTEXT_KEYS} fields`,
  });

const requestSchema = z.object({
  question: z.string().trim().min(3).max(4_000),
  context: contextSchema.optional(),
});

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

async function warmQuestionEmbedding(question: string, userId: string): Promise<void> {
  try {
    await generateEmbedding(question, userId, { requireSemantic: true });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: 'copilot_query_embedding_warm_failed',
      userId,
    });
  }
}

function filterGroundedMatches<T extends { readonly score: number }>(matches: readonly T[]): T[] {
  return matches
    .filter((match) => Number.isFinite(match.score) && match.score >= MIN_GROUNDING_SCORE)
    .slice(0, RAG_RESULT_LIMIT);
}

async function gatherGroundingContext(
  question: string,
  userId: string,
  dashboardContext: Record<string, string | number | boolean> | undefined
): Promise<CopilotGroundingContext> {
  // One embedding is shared by all three retrieval paths instead of three duplicate provider calls.
  await warmQuestionEmbedding(question, userId);

  const [breakdownResult, shiftNoteResult, externalDocResult] = await Promise.allSettled([
    searchSimilarBreakdowns(question, userId, RAG_RESULT_LIMIT),
    searchShiftIntelligence(question, userId, RAG_RESULT_LIMIT),
    searchExternalDocuments(question, userId, RAG_RESULT_LIMIT),
  ]);

  const breakdownMatches =
    breakdownResult.status === 'fulfilled'
      ? filterGroundedMatches(breakdownResult.value).map((match) => ({
          id: match.id,
          fleetId: match.fleetId,
          reason: match.reason,
          repairNotes: match.repairNotes,
          score: match.score,
        }))
      : [];

  const shiftNoteMatches =
    shiftNoteResult.status === 'fulfilled'
      ? filterGroundedMatches(shiftNoteResult.value).map((note) => ({
          id: note.id,
          shiftType: note.shiftType,
          noteDate: note.noteDate,
          content: note.content,
          score: note.score,
        }))
      : [];

  const externalDocuments =
    externalDocResult.status === 'fulfilled'
      ? filterGroundedMatches(externalDocResult.value).map((doc) => ({
          id: doc.id,
          title: doc.title,
          source: doc.source,
          content: doc.content.slice(0, MAX_EXTERNAL_DOC_SOURCE_CHARS),
          score: doc.score,
        }))
      : [];

  return {
    question,
    dashboardContext,
    breakdownMatches,
    shiftNoteMatches,
    externalDocuments,
    fleetPredictions: [],
    telemetryAnomalies: [],
  };
}

async function handlePost(request: NextRequest, userId: string): Promise<NextResponse> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid copilot request' }, { status: 400 });
  }

  const { question, context } = parsed.data;
  const grounding = await gatherGroundingContext(question, userId, context);

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
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'copilot_groq_failed',
            userId,
          });
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
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'copilot_openrouter_failed',
            userId,
          });
        }
      }

      return null;
    },
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await connection();
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return withRateLimit(request, () => handlePost(request, principal.user.id), {
    customLimit: { windowMs: 60_000, maxRequests: 10 },
  });
}
