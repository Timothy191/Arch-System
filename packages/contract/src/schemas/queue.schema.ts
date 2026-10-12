import { z } from 'zod';

export const workflowDispatchSchema = z.object({
  workflowId: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  triggeredBy: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type WorkflowDispatch = z.infer<typeof workflowDispatchSchema>;
