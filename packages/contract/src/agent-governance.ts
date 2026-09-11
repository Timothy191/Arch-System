import { z } from 'zod';
export const GovernanceEventPayloadSchema = z.object({
  eventType: z.enum(['PreToolUse', 'PostToolUse', 'PreInvocation', 'Stop']),
  toolName: z.string(),
  targetPath: z.string().optional(),
  exitCode: z.number(),
  blockedReason: z.string().optional()
});
export const HookConsumerTelemetrySchema = z.object({
  hookName: z.string(),
  consumerWorkspace: z.string(),
  mountDurationMs: z.number()
});
