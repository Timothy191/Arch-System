import { z } from 'zod';

/**
 * Parameter schemas for AI-agent tool invocations (SearXNG web search
 * and Wolfram Alpha computation). Owned here as part of the @repo/contract
 * SSoT so no agent package imports "zod" directly.
 */

export const searxngToolParamsSchema = z.object({
  query: z.string().describe('The search query to send to SearXNG.'),
  categories: z
    .array(z.string())
    .optional()
    .describe("Optional categories like 'science', 'it', 'general'."),
});

export const wolframToolParamsSchema = z.object({
  query: z.string().describe('The mathematical or factual query to compute.'),
});

export type SearxngToolParams = z.infer<typeof searxngToolParamsSchema>;
export type WolframToolParams = z.infer<typeof wolframToolParamsSchema>;
