/**
 * External content indexer for the RAG system.
 *
 * Fetches content from web URLs, GitHub repositories, and local docs,
 * chunks it via `chunkForEmbedding`, generates embeddings via
 * `batchGenerateEmbeddings`, and stores the vectors in `memory_embeddings`
 * using the same pattern as `indexBreakdownVector` in `mining-rag.ts`.
 */

import { logger } from '@repo/logger/server';
import { searchAvailability, upsertVector } from '@repo/redis/search';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { assertSafeUrl } from '@/lib/integrations/ssrf-guard';
import { chunkForEmbedding } from './chunking';
import { batchGenerateEmbeddings } from './embeddings';
import { DOCUMENTS_VECTOR_SPEC, ensureIndexOnce } from './vector-indexes';

const EXTERNAL_SESSION_ID = 'external_content';
const MEMORY_TYPE = 'semantic';
const MAX_FILES = 200;
const MAX_DEPTH = 5;
const MAX_REDIRECTS = 5;
const URL_FETCH_TIMEOUT_MS = 15_000;
const GITHUB_TREE_TIMEOUT_MS = 20_000;
const MIN_EXTRACTABLE_CONTENT_CHARS = 50;
const INDEXER_USER_AGENT = 'Arch-System-Content-Indexer/1.0';
const GITHUB_SLUG_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

interface IndexedContent {
  source: 'url' | 'github' | 'docs';
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface IndexResult {
  success: boolean;
  indexedCount: number;
  erroredCount: number;
  errors: string[];
}

/**
 * Sanitize and normalize a URL before fetching.
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

export function isValidGitHubSlug(segment: string): boolean {
  return GITHUB_SLUG_PATTERN.test(segment) && segment !== '.' && segment !== '..';
}

/**
 * Fetch raw text content from a URL with SSRF validation on the initial target
 * and every redirect hop, using a fresh AbortController per request.
 */
async function fetchUrlText(url: string): Promise<string> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(currentUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': INDEXER_USER_AGENT,
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch URL ${currentUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const locationHeader = response.headers.get('location');
      if (!locationHeader) {
        throw new Error(`Redirect without Location header from ${currentUrl}`);
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error(`Too many redirects while fetching ${url}`);
      }
      currentUrl = new URL(locationHeader, currentUrl).toString();
      assertSafeUrl(currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  }

  throw new Error(`Exceeded redirect limit for ${url}`);
}

/**
 * Strip HTML tags and scripts/styles to get readable text.
 * Cheap, dependency-free extraction that works in server actions.
 */
function extractTextFromHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Index content fetched from a URL into the semantic vector store.
 * Splits the content into chunks, embeds each chunk, and stores vectors.
 */
async function indexContent(
  item: IndexedContent,
  userId: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const chunks = chunkForEmbedding(item.content, {
    contentType: 'document',
    maxChunkSize: 512,
    overlapSize: 128,
  });

  if (chunks.length === 0) {
    return { success: false, error: 'No indexable text chunks extracted' };
  }

  const texts = chunks.map((c) => c.text);
  const vectors = await batchGenerateEmbeddings(texts, userId, { requireSemantic: true });

  const supabase = await createServerSupabaseClient();
  const { data: insertedRows, error } = await supabase
    .from('memory_embeddings')
    .insert(
      chunks.map((chunk, idx) => ({
        session_id: EXTERNAL_SESSION_ID,
        user_id: userId,
        content: chunk.text,
        embedding: JSON.stringify(vectors[idx] ?? []),
        memory_type: MEMORY_TYPE,
        metadata: {
          source: item.source,
          source_id: item.sourceId,
          title: item.title,
          ...item.metadata,
        },
      }))
    )
    .select('id');

  if (error) {
    logger.error(
      { source: item.source, sourceId: item.sourceId, error: error.message },
      'Failed to index external content'
    );
    return { success: false, error: error.message };
  }

  try {
    const availability = await searchAvailability();
    if (availability.available && (await ensureIndexOnce(DOCUMENTS_VECTOR_SPEC))) {
      await Promise.all(
        chunks.map((chunk, idx) =>
          upsertVector({
            spec: DOCUMENTS_VECTOR_SPEC,
            id: insertedRows?.[idx]?.id ?? `${item.source}:${item.sourceId}:${idx}`,
            vector: new Float32Array(vectors[idx] ?? []),
            fields: {
              session_id: EXTERNAL_SESSION_ID,
              user_id: userId,
              content: chunk.text,
              source: item.source,
              source_id: item.sourceId,
              title: item.title,
            },
          })
        )
      );
    }
  } catch (redisErr) {
    console.warn(`Non-fatal Redis Stack sync failed for ${item.source}:${item.sourceId}`, redisErr);
  }

  return { success: true };
}

/**
 * Fetch and index a single web URL.
 *
 * Returns `{ success, indexedCount, errors }`. On error the count is 0
 * and the error message is recorded.
 */
export async function fetchAndIndexUrl(url: string, userId: string): Promise<IndexResult> {
  const errors: string[] = [];

  let cleanUrl: string;
  try {
    cleanUrl = normalizeUrl(url);
    assertSafeUrl(cleanUrl);
  } catch (error) {
    return {
      success: false,
      indexedCount: 0,
      erroredCount: 1,
      errors: [error instanceof Error ? error.message : `Invalid URL: ${url}`],
    };
  }

  try {
    const content = await fetchUrlText(cleanUrl);

    if (!content || content.length < MIN_EXTRACTABLE_CONTENT_CHARS) {
      return {
        success: false,
        indexedCount: 0,
        erroredCount: 1,
        errors: [`No extractable content from ${cleanUrl}`],
      };
    }

    const item: IndexedContent = {
      source: 'url',
      sourceId: cleanUrl,
      title: cleanUrl,
      content,
      metadata: {
        fetched_at: new Date().toISOString(),
        content_type: 'web',
      },
    };

    const result = await indexContent(item, userId);
    if (!result.success) {
      errors.push(`Failed to store embedding for ${cleanUrl}`);
      return { success: false, indexedCount: 0, erroredCount: 1, errors };
    }

    // Count chunks indexed (store returns success per batch; count approx)
    const chunks = chunkForEmbedding(content, {
      contentType: 'document',
      maxChunkSize: 512,
      overlapSize: 128,
    });

    return {
      success: true,
      indexedCount: chunks.length,
      erroredCount: 0,
      errors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`URL ${cleanUrl}: ${message}`);
    return { success: false, indexedCount: 0, erroredCount: 1, errors };
  }
}

async function fetchGitHubTreeForBranch(
  owner: string,
  repo: string,
  branch: string
): Promise<Response> {
  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  assertSafeUrl(treeUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TREE_TIMEOUT_MS);
  try {
    return await fetch(treeUrl, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': INDEXER_USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch and index GitHub repository file contents using the public API.
 * Fetches the default branch tree (`main` or `master`, up to a cap) and indexes each text file.
 */
export async function fetchAndIndexGitHubRepo(
  owner: string,
  repo: string,
  path: string,
  userId: string
): Promise<IndexResult> {
  const errors: string[] = [];

  if (!isValidGitHubSlug(owner) || !isValidGitHubSlug(repo)) {
    return {
      success: false,
      indexedCount: 0,
      erroredCount: 1,
      errors: ['Invalid GitHub owner or repository slug'],
    };
  }

  try {
    const mainResponse = await fetchGitHubTreeForBranch(owner, repo, 'main');
    if (mainResponse.ok) {
      return await indexGitHubTree({
        treeData: await mainResponse.json(),
        owner,
        repo,
        branch: 'main',
        pathFilter: path,
        userId,
        errors,
      });
    }

    const masterResponse = await fetchGitHubTreeForBranch(owner, repo, 'master');
    if (!masterResponse.ok) {
      return {
        success: false,
        indexedCount: 0,
        erroredCount: 1,
        errors: [`GitHub API returned ${mainResponse.status} for ${owner}/${repo}`],
      };
    }

    return await indexGitHubTree({
      treeData: await masterResponse.json(),
      owner,
      repo,
      branch: 'master',
      pathFilter: path,
      userId,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`GitHub repo ${owner}/${repo}: ${message}`);
    return { success: false, indexedCount: 0, erroredCount: 1, errors };
  }
}

interface IndexGitHubTreeOptions {
  readonly treeData: unknown;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  readonly pathFilter: string;
  readonly userId: string;
  readonly errors: string[];
}

/**
 * Process a GitHub tree response: filter text files, fetch content from resolved branch, index.
 */
async function indexGitHubTree(options: IndexGitHubTreeOptions): Promise<IndexResult> {
  const { treeData, owner, repo, branch, pathFilter, userId, errors } = options;
  const tree = (treeData as { tree?: Array<{ path: string; type: string; sha: string }> }).tree;
  if (!Array.isArray(tree)) {
    errors.push(`GitHub tree for ${owner}/${repo} was empty or malformed`);
    return { success: false, indexedCount: 0, erroredCount: 1, errors };
  }

  const TEXT_EXTENSIONS = [
    '.md',
    '.txt',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.cfg',
    '.ini',
    '.py',
    '.go',
    '.rs',
    '.java',
    '.kt',
    '.rb',
    '.php',
    '.swift',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.scala',
  ];

  const textFiles = tree.filter((node) => {
    if (node.type !== 'blob') return false;
    if (pathFilter && !node.path.startsWith(pathFilter)) return false;
    const ext = node.path.slice(node.path.lastIndexOf('.')).toLowerCase();
    return TEXT_EXTENSIONS.includes(ext);
  });

  if (textFiles.length === 0) {
    errors.push(
      `No indexable text files found in ${owner}/${repo}${pathFilter ? ` at ${pathFilter}` : ''}`
    );
    return { success: false, indexedCount: 0, erroredCount: 0, errors };
  }

  const limitedFiles = textFiles.slice(0, MAX_FILES);
  let indexedCount = 0;

  for (const file of limitedFiles) {
    const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
    try {
      const content = await fetchUrlText(rawUrl);
      if (!content || content.length < MIN_EXTRACTABLE_CONTENT_CHARS) continue;

      const item: IndexedContent = {
        source: 'github',
        sourceId: `${owner}/${repo}#${file.path}`,
        title: file.path,
        content,
        metadata: {
          owner,
          repo,
          branch,
          path: file.path,
          fetched_at: new Date().toISOString(),
          content_type: 'github',
        },
      };

      const result = await indexContent(item, userId);
      if (result.success) indexedCount++;
      else errors.push(result.error ?? `Failed to index ${file.path}`);
    } catch (error) {
      errors.push(
        error instanceof Error ? `${file.path}: ${error.message}` : `Failed to fetch ${file.path}`
      );
    }
  }

  return {
    success: indexedCount > 0,
    indexedCount,
    erroredCount: limitedFiles.length - indexedCount,
    errors,
  };
}

/**
 * Index local markdown/docs from a directory path.
 * Reads files recursively (limited depth) and indexes them.
 */
export async function indexLocalDocs(dirPath: string, userId: string): Promise<IndexResult> {
  const errors: string[] = [];
  if (!existsSync(dirPath)) {
    errors.push(`Directory not found: ${dirPath}`);
    return Promise.resolve({ success: false, indexedCount: 0, erroredCount: 1, errors });
  }

  const files = collectMarkdownFiles(dirPath, []);
  if (files.length === 0) {
    errors.push(`No markdown/docs found in ${dirPath}`);
    return Promise.resolve({ success: false, indexedCount: 0, erroredCount: 0, errors });
  }

  let indexedCount = 0;
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (!content || content.length < 50) continue;

      const item: IndexedContent = {
        source: 'docs',
        sourceId: file,
        title: basename(file),
        content,
        metadata: {
          file_path: file,
          fetched_at: new Date().toISOString(),
          content_type: 'docs',
        },
      };

      const result = await indexContent(item, userId);
      if (result.success) indexedCount++;
      else errors.push(result.error ?? `Failed to index ${file}`);
    } catch (error) {
      errors.push(error instanceof Error ? `${file}: ${error.message}` : `Failed to read ${file}`);
    }
  }

  return Promise.resolve({
    success: indexedCount > 0,
    indexedCount,
    erroredCount: files.length - indexedCount,
    errors,
  });
}

/**
 * Recursively collect markdown/text files from a directory (enforcing MAX_DEPTH = 5 and MAX_FILES cap).
 */
function collectMarkdownFiles(dir: string, acc: string[], depth = 0): string[] {
  if (depth > MAX_DEPTH || acc.length >= MAX_FILES) return acc;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= MAX_FILES) break;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) {
        collectMarkdownFiles(full, acc, depth + 1);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.md', '.markdown', '.txt', '.ts', '.tsx'].includes(ext)) {
        acc.push(full);
      }
    }
  }
  return acc;
}
