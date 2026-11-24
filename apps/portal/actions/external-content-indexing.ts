'use server';

import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  fetchAndIndexGitHubRepo,
  fetchAndIndexUrl,
  indexLocalDocs,
} from '@/lib/ai/external-content-indexer';

const INDEXING_RATE_LIMIT_MAX = 10;
const INDEXING_RATE_LIMIT_WINDOW_MS = 60_000;

const externalIndexingLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: INDEXING_RATE_LIMIT_MAX,
  windowMs: INDEXING_RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:external_content_index:',
});

const PRIVATE_OR_LOOPBACK_HOST_PATTERN =
  /^(localhost|0\.0\.0\.0|::1|\[::1\]|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;

function isSafeExternalHttpUrl(
  rawUrl: string
): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Only http:// and https:// URLs are permitted' };
    }
    if (
      PRIVATE_OR_LOOPBACK_HOST_PATTERN.test(parsed.hostname) ||
      parsed.hostname.endsWith('.local')
    ) {
      return { ok: false, error: 'Private, loopback, and metadata hostnames are not permitted' };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'Invalid external URL format' };
  }
}

function validateLocalDocsPath(rawPath: string): string | null {
  if (process.env.VERCEL) {
    return 'Local filesystem indexing is disabled in serverless production deployments';
  }
  const trimmed = rawPath.trim();
  if (!trimmed) return 'dirPath required for local docs indexing';
  if (trimmed.includes('\0') || trimmed.split(/[/\\]/).includes('..')) {
    return 'Path traversal segments are not permitted in dirPath';
  }
  return null;
}

const InputSchema = z.object({
  source: z.enum(['url', 'github', 'local-docs']),
  sourceId: z.string().optional(),
  userId: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  path: z.string().optional(),
  dirPath: z.string().optional(),
});

export async function externalContentIndexing(input: {
  source: 'url' | 'github' | 'local-docs';
  sourceId?: string;
  userId?: string;
  owner?: string;
  repo?: string;
  path?: string;
  dirPath?: string;
}): Promise<{ success: boolean; indexedCount?: number; errors?: string[] }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, errors: ['Unauthorized'] };
  }

  const { data: callerEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (callerEmployee?.role !== 'admin') {
    return { success: false, errors: ['Forbidden: admin role required'] };
  }

  const rateLimit = await externalIndexingLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return { success: false, errors: ['Rate limit exceeded'] };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  let result: { indexedCount: number; erroredCount: number; errors: string[] };
  try {
    switch (parsed.data.source) {
      case 'url': {
        if (!parsed.data.sourceId?.trim()) {
          return { success: false, errors: ['sourceId required for URL indexing'] };
        }
        const checkedUrl = isSafeExternalHttpUrl(parsed.data.sourceId);
        if (!checkedUrl.ok) {
          return { success: false, errors: [checkedUrl.error] };
        }
        result = await fetchAndIndexUrl(checkedUrl.url, user.id);
        break;
      }
      case 'github':
        if (!parsed.data.owner?.trim() || !parsed.data.repo?.trim()) {
          return {
            success: false,
            errors: ['owner and repo required for GitHub indexing'],
          };
        }
        result = await fetchAndIndexGitHubRepo(
          parsed.data.owner.trim(),
          parsed.data.repo.trim(),
          parsed.data.path?.trim() ?? '',
          user.id
        );
        break;
      case 'local-docs': {
        const pathError = validateLocalDocsPath(parsed.data.dirPath ?? '');
        if (pathError) {
          return { success: false, errors: [pathError] };
        }
        result = await indexLocalDocs(parsed.data.dirPath!.trim(), user.id);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, indexedCount: 0, errors: [message] };
  }

  const safeResult = result ?? { indexedCount: 0, erroredCount: 0, errors: [] };

  logger.info({
    event: 'admin_external_content_indexed',
    actorId: user.id,
    source: parsed.data.source,
    indexedCount: safeResult.indexedCount,
    erroredCount: safeResult.erroredCount,
  });

  if (safeResult.erroredCount > 0 && safeResult.indexedCount === 0) {
    return { success: false, indexedCount: safeResult.indexedCount, errors: safeResult.errors };
  }

  await cacheInvalidateTags(['memory_embeddings']);
  revalidatePath('/');

  return {
    success: true,
    indexedCount: safeResult.indexedCount,
    errors: safeResult.errors.length > 0 ? safeResult.errors : undefined,
  };
}
