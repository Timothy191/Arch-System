import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors/error-logger";
import {
  riskAssessmentSchema,
  type RiskAssessment,
  aiPredictSchema,
} from "@repo/contract";
import { chat, DEFAULT_MODEL } from "@/lib/ai/providers";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";

const SYSTEM_PROMPT = `You are an industrial maintenance AI for an industrial operations portal.
Analyse the machine data provided and produce a structured risk assessment.
Hours worked and recent issues are the strongest urgency signals.
Respond ONLY with valid JSON — no markdown fences, no prose — matching this schema:
{
  "risk": "low" | "medium" | "high",
  "actions": ["string"],
  "timeEstimate": "string",
  "summary": "string"
}`;

async function handlePredictRequest(req: NextRequest): Promise<NextResponse> {
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

  const parsed = await validateBody(req, aiPredictSchema);
  if (parsed instanceof NextResponse) {
    return applyCors(req, parsed);
  }

  try {
    const { machineData } = parsed.data;

    const raw = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyse this machine data and provide a risk assessment:\n\n${machineData}\nConsider hours worked, time since last maintenance, and recent issues when assessing risk level.\nReturn ONLY valid JSON — no extra text, no markdown fences.`,
        },
      ],
      { model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 1024 },
    );

    const parsedResult = riskAssessmentSchema.safeParse(
      JSON.parse(raw ?? "{}"),
    );
    if (!parsedResult.success) {
      return applyCors(
        req,
        NextResponse.json(
          {
            risk: "low",
            actions: [],
            timeEstimate: "unknown",
            summary: raw ?? "",
          } satisfies RiskAssessment,
          { status: 200 },
        ),
      );
    }

    return applyCors(req, NextResponse.json(parsedResult.data));
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "predictive_maintenance",
    });
    return applyCors(
      req,
      NextResponse.json(
        { error: "Failed to analyse machine data" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: NextRequest) {
  return withBodyLimit(
    req,
    () => withRateLimit(req, () => handlePredictRequest(req)),
    { maxSize: 1_048_576 },
  );
}
