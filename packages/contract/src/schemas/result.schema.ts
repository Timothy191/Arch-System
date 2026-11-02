import { type ZodType, z } from 'zod';

export const resultErrorDetailSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ResultErrorDetail = z.infer<typeof resultErrorDetailSchema>;

/**
 * Generic CQRS Operation Result envelope.
 * Models discriminated outcome state (success vs failure) without ambiguity.
 */
export function createOperationResultSchema<T extends ZodType>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      message: z.string().optional(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string().min(1),
      errors: z.array(resultErrorDetailSchema).optional(),
    }),
  ]);
}

/**
 * Standard Paginated Result envelope for queries and data tables.
 */
export function createPaginatedResultSchema<T extends ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    totalCount: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  });
}

// Pre-built default result schemas for common operations
export const basicOperationResultSchema = createOperationResultSchema(
  z.record(z.string(), z.unknown()).optional()
);
export type BasicOperationResult = z.infer<typeof basicOperationResultSchema>;
