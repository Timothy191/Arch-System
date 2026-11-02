import { z } from 'zod';
import { uuidSchema } from './common.schema';

export const searchCategoryEnum = z.enum([
  'all',
  'equipment',
  'breakdown',
  'shift_log',
  'operator',
  'incident',
  'document',
]);

export const searchSortOrderEnum = z.enum(['relevance', 'recent', 'severity', 'alphabetical']);

export const mineSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(256),
  category: searchCategoryEnum.default('all'),
  departmentId: uuidSchema.optional().nullable(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  typoTolerance: z.boolean().default(true),
  sortBy: searchSortOrderEnum.default('relevance'),
});

export const mineSearchMatchHighlightSchema = z.object({
  field: z.string().min(1).max(64),
  snippet: z.string().max(512),
  matchPositions: z.array(
    z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  ),
});

export const mineSearchResultItemSchema = z.object({
  id: z.string().min(1).max(128),
  category: searchCategoryEnum,
  title: z.string().min(1).max(256),
  subtitle: z.string().max(256).optional().nullable(),
  department: z.string().max(64).optional().nullable(),
  score: z.number().min(0).max(1),
  url: z.string().max(512),
  metadata: z.record(z.string(), z.unknown()).default({}),
  highlights: z.array(mineSearchMatchHighlightSchema).default([]),
});

export const mineSearchResponseSchema = z.object({
  hits: z.array(mineSearchResultItemSchema),
  totalHits: z.number().int().nonnegative(),
  query: z.string(),
  processingTimeMs: z.number().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type SearchCategory = z.infer<typeof searchCategoryEnum>;
export type SearchSortOrder = z.infer<typeof searchSortOrderEnum>;
export type MineSearchQuery = z.infer<typeof mineSearchQuerySchema>;
export type MineSearchMatchHighlight = z.infer<typeof mineSearchMatchHighlightSchema>;
export type MineSearchResultItem = z.infer<typeof mineSearchResultItemSchema>;
export type MineSearchResponse = z.infer<typeof mineSearchResponseSchema>;
