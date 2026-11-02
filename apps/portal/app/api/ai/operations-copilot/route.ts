import { getAuthenticatedEmployee } from '@repo/supabase';
import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/api/rate-limit-middleware';

const requestSchema = z.object({
  question: z.string().trim().min(3).max(4_000),
  context: z.record(z.string(), z.unknown()).optional(),
});

const SYSTEM_PROMPT = `You are the Arch Systems operations copilot. Give concise, evidence-based guidance for mining operations. Never invent telemetry, permissions, incidents, or actions. Clearly separate observed facts from recommendations. Recommend escalation for safety-critical, compliance, or production-impacting decisions. Do not execute actions; describe the next safe step.`;

const providerRequest = (
  model: string,
  question: string,
  context: Record<string, unknown> | undefined
) => ({
  model,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Operator request: ${question}\nAvailable dashboard context (may be empty): ${JSON.stringify(context ?? {})}`,
    },
  ],
  temperature: 0.2,
  max_tokens: 700,
});

async function callProvider(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  question: string;
  context?: Record<string, unknown>;
  provider: 'groq' | 'openrouter';
}) {
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
    body: JSON.stringify(providerRequest(options.model, options.question, options.context)),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`${options.provider} returned ${response.status}`);
  const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = result.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error(`${options.provider} returned an empty response`);
  return answer;
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const principal = await getAuthenticatedEmployee();
  if (!principal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid copilot request' }, { status: 400 });

  const { question, context } = parsed.data;
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const attempts: Array<{ provider: 'groq' | 'openrouter'; model: string }> = [];

  if (groqKey) {
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    attempts.push({ provider: 'groq', model });
    try {
      const answer = await callProvider({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: groqKey,
        model,
        question,
        context,
        provider: 'groq',
      });
      return NextResponse.json({ answer, provider: 'groq', model, fallbackUsed: false });
    } catch {
      // OpenRouter below is the intentional resilience path.
    }
  }

  if (openRouterKey) {
    const model = 'openrouter/free';
    attempts.push({ provider: 'openrouter', model });
    try {
      const answer = await callProvider({
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: openRouterKey,
        model,
        question,
        context,
        provider: 'openrouter',
      });
      return NextResponse.json({
        answer,
        provider: 'openrouter',
        model,
        fallbackUsed: attempts.length > 1,
      });
    } catch {
      // Return a generic failure without exposing provider details or credentials.
    }
  }

  return NextResponse.json(
    { error: 'The operations copilot is temporarily unavailable.' },
    { status: 503 }
  );
}

export async function POST(request: NextRequest) {
  await connection();
  return withRateLimit(request, () => handlePost(request), {
    customLimit: { windowMs: 60_000, maxRequests: 10 },
  });
}
