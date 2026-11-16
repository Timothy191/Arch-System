'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  fetchAndIndexGitHubRepo,
  fetchAndIndexUrl,
  indexLocalDocs,
} from '@/lib/ai/external-content-indexer';

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

  // Check admin role
  const { data: callerEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (callerEmployee?.role !== 'admin') {
    return { success: false, errors: ['Forbidden: admin role required'] };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  let result: { indexedCount: number; erroredCount: number; errors: string[] };
  try {
    switch (parsed.data.source) {
      case 'url':
        if (!parsed.data.sourceId) {
          return { success: false, errors: ['sourceId required for URL indexing'] };
        }
        result = await fetchAndIndexUrl(parsed.data.sourceId, user.id);
        break;
      case 'github':
        if (!parsed.data.owner || !parsed.data.repo) {
          return {
            success: false,
            errors: ['owner and repo required for GitHub indexing'],
          };
        }
        result = await fetchAndIndexGitHubRepo(
          parsed.data.owner,
          parsed.data.repo,
          parsed.data.path ?? '',
          user.id
        );
        break;
      case 'local-docs':
        if (!parsed.data.dirPath) {
          return { success: false, errors: ['dirPath required for local docs indexing'] };
        }
        result = await indexLocalDocs(parsed.data.dirPath, user.id);
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, indexedCount: 0, errors: [message] };
  }

  const safeResult = result ?? { indexedCount: 0, erroredCount: 0, errors: [] };

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
