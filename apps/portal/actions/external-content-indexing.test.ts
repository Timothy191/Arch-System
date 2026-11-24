/**
 * @jest-environment node
 */

import { logger } from '@repo/logger/server';
import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import {
  fetchAndIndexGitHubRepo,
  fetchAndIndexUrl,
  indexLocalDocs,
} from '@/lib/ai/external-content-indexer';
import { externalContentIndexing } from './external-content-indexing';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@repo/logger/server', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/ai/external-content-indexer', () => ({
  fetchAndIndexUrl: jest.fn(),
  fetchAndIndexGitHubRepo: jest.fn(),
  indexLocalDocs: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);

function mockAuth(userId: string | null, role = 'admin') {
  mockCreateServerSupabaseClient.mockResolvedValueOnce({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { role } }),
        }),
      }),
    })),
  } as never);
}

describe('externalContentIndexing server action', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERCEL;
  });

  afterAll(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    mockAuth(null);
    expect(
      await externalContentIndexing({ source: 'url', sourceId: 'https://example.com' })
    ).toEqual({
      success: false,
      errors: ['Unauthorized'],
    });

    mockAuth('u-op', 'operator');
    expect(
      await externalContentIndexing({ source: 'url', sourceId: 'https://example.com' })
    ).toEqual({
      success: false,
      errors: ['Forbidden: admin role required'],
    });
  });

  it('blocks SSRF loopback/private URLs and path traversal or serverless local-docs calls', async () => {
    mockAuth('u-sec-1');
    const localUrlRes = await externalContentIndexing({
      source: 'url',
      sourceId: 'http://127.0.0.1:8080/internal',
    });
    expect(localUrlRes.success).toBe(false);
    expect(localUrlRes.errors?.[0]).toContain('Private, loopback');

    mockAuth('u-sec-1');
    const metaUrlRes = await externalContentIndexing({
      source: 'url',
      sourceId: 'http://169.254.169.254/latest/meta-data',
    });
    expect(metaUrlRes.success).toBe(false);

    mockAuth('u-sec-1');
    const traversalRes = await externalContentIndexing({
      source: 'local-docs',
      dirPath: '../../etc/passwd',
    });
    expect(traversalRes.success).toBe(false);
    expect(traversalRes.errors?.[0]).toContain('traversal');

    process.env.VERCEL = '1';
    mockAuth('u-sec-1');
    const vercelLocalRes = await externalContentIndexing({
      source: 'local-docs',
      dirPath: '/docs/sop',
    });
    expect(vercelLocalRes.success).toBe(false);
    expect(vercelLocalRes.errors?.[0]).toContain('serverless');
  });

  it('indexes safe URL and GitHub repo using authenticated userId and emits audit log', async () => {
    mockAuth('u-happy-1');
    jest.mocked(fetchAndIndexUrl).mockResolvedValueOnce({
      indexedCount: 5,
      erroredCount: 0,
      errors: [],
    });
    const urlRes = await externalContentIndexing({
      source: 'url',
      sourceId: 'https://docs.plantcor.example/safety',
      userId: 'spoofed-user',
    });
    expect(urlRes).toEqual({ success: true, indexedCount: 5, errors: undefined });
    expect(fetchAndIndexUrl).toHaveBeenCalledWith(
      'https://docs.plantcor.example/safety',
      'u-happy-1'
    );

    mockAuth('u-happy-1');
    jest.mocked(fetchAndIndexGitHubRepo).mockResolvedValueOnce({
      indexedCount: 8,
      erroredCount: 0,
      errors: [],
    });
    const ghRes = await externalContentIndexing({
      source: 'github',
      owner: 'Timothy191',
      repo: 'Arch-System',
      path: 'docs',
    });
    expect(ghRes.success).toBe(true);
    expect(fetchAndIndexGitHubRepo).toHaveBeenCalledWith(
      'Timothy191',
      'Arch-System',
      'docs',
      'u-happy-1'
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'admin_external_content_indexed', actorId: 'u-happy-1' })
    );
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['memory_embeddings']);
    expect(indexLocalDocs).not.toHaveBeenCalled();
  });
});
