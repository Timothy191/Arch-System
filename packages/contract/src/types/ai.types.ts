import type { z } from "zod";
import type {
  aiChatSchema,
  aiSafetySchema,
  aiPredictSchema,
  aiHandoffSchema,
  riskAssessmentSchema,
  complianceResultSchema,
} from "../schemas/ai.schema.js";

export type AiChatInput = z.infer<typeof aiChatSchema>;
export type AiSafetyInput = z.infer<typeof aiSafetySchema>;
export type AiPredictInput = z.infer<typeof aiPredictSchema>;
export type AiHandoffInput = z.infer<typeof aiHandoffSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type ComplianceResult = z.infer<typeof complianceResultSchema>;
