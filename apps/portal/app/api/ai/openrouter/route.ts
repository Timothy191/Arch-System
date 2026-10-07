import {
  AgentCursorTracker,
  createChatCompletion,
  getAccountCredits,
  getAvailableModels,
  OpenRouterChatRequest,
} from '@repo/utils';
import { connection, NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ai/openrouter
 * Returns available models and account credits.
 */
export async function GET(_request: NextRequest) {
  await connection();
  try {
    const [modelsResponse, creditsResponse] = await Promise.all([
      getAvailableModels(),
      getAccountCredits(),
    ]);

    return NextResponse.json(
      {
        models: modelsResponse.data,
        credits: creditsResponse.data,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/openrouter
 * Submits a chat completion request to OpenRouter.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const body: OpenRouterChatRequest = await request.json();

    if (!body.model || !body.messages) {
      return NextResponse.json(
        { error: 'Missing required fields: model, messages' },
        { status: 400 }
      );
    }

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
