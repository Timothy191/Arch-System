import { getAuthenticatedEmployee } from '@repo/supabase';
import {
  AgentCursorTracker,
  createChatCompletion,
  getAccountCredits,
  getAvailableModels,
  OpenRouterChatRequest,
} from '@repo/utils';
import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const chatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.union([
      z.string().max(50_000),
      z
        .array(
          z.object({
            type: z.string().max(50),
            text: z.string().max(50_000).optional(),
            image_url: z.object({ url: z.string().max(2_000) }).optional(),
          })
        )
        .max(20),
    ]),
    name: z.string().max(200).optional(),
    tool_call_id: z.string().max(200).optional(),
  })
  .strict();

// AGENT-TRACE: This proxy only supports plain chat completion. Tool and
// provider-routing fields are intentionally rejected so authenticated callers
// cannot drive arbitrary upstream features through the server key.
const chatRequestSchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z.array(chatMessageSchema).min(1).max(50),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(32_000).optional(),
    stream: z.boolean().optional(),
  })
  .strict();

function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Unauthorized access', code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

/**
 * GET /api/ai/openrouter
 * Returns available models. Account credits are admin-only.
 */
async function handleGet(): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return unauthorized();

  try {
    const modelsResponse = await getAvailableModels();

    if (principal.employee?.role !== 'admin') {
      return NextResponse.json({ models: modelsResponse.data }, { status: 200 });
    }

    const creditsResponse = await getAccountCredits();
    return NextResponse.json(
      { models: modelsResponse.data, credits: creditsResponse.data },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  await connection();
  return withRateLimit(request, handleGet);
}

/**
 * POST /api/ai/openrouter
 * Submits a chat completion request to OpenRouter on behalf of a signed-in employee.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return unauthorized();

  try {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chat completion request',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const body: OpenRouterChatRequest = parsed.data;

    // --- FULCRA LIFE CONTEXT INJECTION ---
    const lifeContext = await AgentCursorTracker.getLifeContext();
    const systemInstruction = {
      role: 'system' as const,
      content: `[REAL-TIME CONTEXT] You are a highly personalized AI. Current user telemetry: ${JSON.stringify(lifeContext)}`,
    };

    // Prepend the system instruction to the messages array
    body.messages = [systemInstruction, ...body.messages];

    const completion = await createChatCompletion(body);

    return NextResponse.json(completion, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await connection();
  return withRateLimit(request, () => handlePost(request), {
    customLimit: { windowMs: 60_000, maxRequests: 20 },
  });
}
