import { z } from 'zod';

export function validateMutation<T>(schema: z.ZodType<T>, payload: unknown): T {
  // Use .strict() for object schemas when validating boundaries.
  // Falls back to standard parse for non-object ZodType instances.
  if (schema instanceof z.ZodObject) {
    return schema.strict().parse(payload) as T;
  }
  return schema.parse(payload);
}
