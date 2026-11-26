'use server';

import fs from 'node:fs';
import path from 'node:path';
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
import { assertSafeResolvedUrl } from '@/lib/integrations/ssrf-guard';

const INDEXING_RATE_LIMIT_MAX = 10;
const INDEXING_RATE_LIMIT_WINDOW_MS = 60_000;
const GITHUB_SLUG_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

const externalIndexingLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: INDEXING_RATE_LIMIT_MAX,
  windowMs: INDEXING_RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:external_content_index:',
});

async function isSafeExternalHttpUrl(
  rawUrl: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'Invalid external URL format' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// URLs are permitted' };
  }
  try {
    await assertSafeResolvedUrl(parsed.toString());
  } catch {
    return {
      ok: false,
      error: 'Private, loopback, internal, and metadata hostnames are not permitted',
    };
  }
  return { ok: true, url: parsed.toString() };
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
  const docsRoot = path.resolve(process.cwd(), 'docs');
  const resolvedTarget = path.resolve(process.cwd(), trimmed);
  if (resolvedTarget !== docsRoot && !resolvedTarget.startsWith(`${docsRoot}${path.sep}`)) {
    return 'Local docs indexing is restricted to paths under the workspace docs/ directory';
  }
  try {
    const realRoot = fs.realpathSync(docsRoot);
    const realTarget = fs.realpathSync(resolvedTarget);
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
      return 'Resolved path escapes the workspace docs/ allowlist';
    }
  } catch {
    return 'Target directory under docs/ does not exist';
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
        const checkedUrl = await isSafeExternalHttpUrl(parsed.data.sourceId);
        if (!checkedUrl.ok) {
          return { success: false, errors: [checkedUrl.error] };
        }
        result = await fetchAndIndexUrl(checkedUrl.url, user.id);
        break;
      }
      case 'github': {
        const cleanOwner = parsed.data.owner?.trim() ?? '';
        const cleanRepo = parsed.data.repo?.trim() ?? '';
        if (!cleanOwner || !cleanRepo) {
          return {
            success: false,
            errors: ['owner and repo required for GitHub indexing'],
          };
        }
        if (
          !GITHUB_SLUG_PATTERN.test(cleanOwner) ||
          !GITHUB_SLUG_PATTERN.test(cleanRepo) ||
          cleanOwner === '.' ||
          cleanOwner === '..' ||
          cleanRepo === '.' ||
          cleanRepo === '..'
        ) {
          return {
            success: false,
            errors: ['Invalid GitHub owner or repository slug'],
          };
        }
        result = await fetchAndIndexGitHubRepo(
          cleanOwner,
          cleanRepo,
          parsed.data.path?.trim() ?? '',
          user.id
        );
        break;
      }
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
