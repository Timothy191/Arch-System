import { z } from "zod";

// ---------------------------------------------------------------------------
// AI Chat
// ---------------------------------------------------------------------------

export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(32768),
        parts: z
          .array(z.object({ type: z.string(), text: z.string().optional() }))
          .optional(),
      }),
    )
    .min(1, "At least one message required")
    .max(50, "Too many messages"),
  context: z.string().max(4096).optional(),
  sessionId: z.string().min(1).max(256).optional(),
  model: z.string().max(128).optional(),
});

export const aiSafetySchema = z.object({
  logData: z.string().min(1).max(50000),
});

export const aiPredictSchema = z.object({
  machineData: z.string().min(1).max(50000),
});

export const aiHandoffSchema = z.object({
  shiftData: z.string().min(1).max(50000),
});

// ---------------------------------------------------------------------------
// AI Assessment Results
// ---------------------------------------------------------------------------

export const riskAssessmentSchema = z.object({
  risk: z.enum(["low", "medium", "high"]),
  actions: z.array(z.string()),
  timeEstimate: z.string(),
  summary: z.string(),
});

export const complianceResultSchema = z.object({
  violations: z.array(z.string()),
  concerns: z.array(z.string()),
  score: z.number().min(1).max(10),
  summary: z.string(),
});
