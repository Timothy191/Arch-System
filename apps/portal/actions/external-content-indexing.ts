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
  sourceId: z.string().min(1),
  userId: z.string().min(1),
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
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, errors: ['Unauthorized'] };
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, errors: ['Forbidden: admin role required'] };
  }

  let result;
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

  if (result.erroredCount > 0 && result.indexedCount === 0) {
    return { success: false, indexedCount: result.indexedCount, errors: result.errors };
  }

  await cacheInvalidateTags(['memory_embeddings']);
  revalidatePath('/');

  return {
    success: true,
    indexedCount: result.indexedCount,
    errors: result.errors.length > 0 ? result.errors : undefined,
  };
}
