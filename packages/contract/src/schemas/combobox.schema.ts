import { z } from 'zod';

/**
 * Standard Combobox / Multi-Select Option contract.
 * Replaces direct DOM manipulation or legacy jQuery select plugins
 * with pure, accessible React/Radix combobox primitives.
 */
export const comboboxOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  disabled: z.boolean().optional(),
  group: z.string().optional(),
  icon: z.string().optional(),
  badge: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ComboboxOption = z.infer<typeof comboboxOptionSchema>;

/**
 * Debounced search and filter query for remote/virtualized combobox collections.
 */
export const comboboxQuerySchema = z.object({
  query: z.string(),
  selectedValues: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).default(20),
  groupFilter: z.string().optional(),
});
export type ComboboxQuery = z.infer<typeof comboboxQuerySchema>;

/**
 * Result envelope returned from server actions / endpoints powering combobox lookups.
 */
export const comboboxFilterResultSchema = z.object({
  options: z.array(comboboxOptionSchema),
  totalMatches: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type ComboboxFilterResult = z.infer<typeof comboboxFilterResultSchema>;
