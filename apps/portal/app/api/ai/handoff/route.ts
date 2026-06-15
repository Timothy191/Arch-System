import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors/error-logger";
import { chat, DEFAULT_MODEL } from "@/lib/ai/providers";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";
import { aiHandoffSchema } from "@repo/contract";

async function handleHandoffRequest(req: NextRequest): Promise<NextResponse> {
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

  const parsed = await validateBody(req, aiHandoffSchema);
  if (parsed instanceof NextResponse) {
    return applyCors(req, parsed);
  }

  try {
    const { shiftData } = parsed.data;

    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are a shift supervisor AI for an industrial operations portal. Summarize the shift concisely: key accomplishments, ongoing issues, critical alerts, and recommended priorities for the next shift. Be brief and actionable.",
        },
        {
          role: "user",
          content: `Generate a shift handoff report from this data:\n\n${shiftData}`,
        },
      ],
      { model: DEFAULT_MODEL, temperature: 0.5, maxTokens: 1024 },
    );

    return applyCors(req, NextResponse.json({ content: text }));
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "shift_handoff",
    });
    return applyCors(
      req,
      NextResponse.json(
        { error: "Failed to generate shift handoff report" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: NextRequest) {
  return withBodyLimit(
    req,
    () => withRateLimit(req, () => handleHandoffRequest(req)),
    { maxSize: 1_048_576 },
  );
}
