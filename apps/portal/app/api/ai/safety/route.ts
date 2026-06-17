/**
 * @swagger
 * /api/ai/safety:
 *   post:
 *     summary: Analyze safety compliance
 *     description: AI-powered safety compliance analysis that reviews shift logs for violations, near-misses, and concerns. Assigns a safety score from 1-10.
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
 *               - logData
 *             properties:
 *               logData:
 *                 type: string
 *                 description: Shift log data to analyze for safety compliance
 *     responses:
 *       200:
 *         description: Safety compliance analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 violations:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of safety violations detected
 *                 concerns:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of safety concerns identified
 *                 score:
 *                   type: number
 *                   minimum: 1
 *                   maximum: 10
 *                   description: Overall safety score (1=poor, 10=excellent)
 *                 summary:
 *                   type: string
 *                   description: Narrative summary of safety analysis
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors/error-logger";
import {
  complianceResultSchema,
  type ComplianceResult,
  aiSafetySchema,
} from "@repo/contract";
import { chat, DEFAULT_MODEL } from "@/lib/ai/providers";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";

const SYSTEM_PROMPT = `You are a safety compliance officer AI for an industrial operations portal.
Review shift logs for safety violations, near-misses, and concerns.
Assign an overall safety score from 1 to 10.

Respond ONLY with valid JSON — no markdown fences, no prose — matching this schema:
{
  "violations": ["string"],
  "concerns": ["string"],
  "score": number,
  "summary": "string"
}`;

async function handleSafetyRequest(req: NextRequest): Promise<NextResponse> {
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

  const parsed = await validateBody(req, aiSafetySchema);
  if (parsed instanceof NextResponse) {
    return applyCors(req, parsed);
  }

  try {
    const { logData } = parsed.data;

    const raw = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Review these shift logs for safety compliance:\n\n${logData}\n\nReturn ONLY valid JSON, no extra text, no markdown fences.`,
        },
      ],
      { model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 1024 },
    );

    const parsedResult = complianceResultSchema.safeParse(
      JSON.parse(raw ?? "{}"),
    );
    if (!parsedResult.success) {
      return applyCors(
        req,
        NextResponse.json(
          {
            violations: [],
            concerns: [],
            score: 0,
            summary: raw ?? "",
          } satisfies ComplianceResult,
          { status: 200 },
        ),
      );
    }

    return applyCors(req, NextResponse.json(parsedResult.data));
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "safety_compliance",
    });
    return applyCors(
      req,
      NextResponse.json(
        { error: "Failed to analyze safety compliance" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: NextRequest) {
  return withBodyLimit(
    req,
    () => withRateLimit(req, () => handleSafetyRequest(req)),
    { maxSize: 1_048_576 },
  );
}
