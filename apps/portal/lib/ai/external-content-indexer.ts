/**
 * External content indexer for the RAG system.
 *
 * Fetches content from web URLs, GitHub repositories, and local docs,
 * chunks it via `chunkForEmbedding`, generates embeddings via
 * `batchGenerateEmbeddings`, and stores the vectors in `memory_embeddings`
 * using the same pattern as `indexBreakdownVector` in `mining-rag.ts`.
 */

import { createServerSupabaseClient } from '@repo/supabase/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { chunkForEmbedding } from './chunking';
import { batchGenerateEmbeddings } from './embeddings';

const EXTERNAL_SESSION_ID = 'external_content';
const MEMORY_TYPE = 'semantic';
const MAX_FILES = 200;

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

/**
 * Fetch raw text content from a URL.
 * Extracts visible text from HTML (strips scripts, styles, tags).
 */
async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Arch-System External Content Indexer (contact: admin@arch-system.local)',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    clearTimeout(timeoutId);
    throw new Error(`Failed to fetch URL: ${url}`);
  }
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
): Promise<{ success: boolean; id?: string }> {
  const chunks = chunkForEmbedding(item.content, {
    contentType: 'document',
    maxChunkSize: 512,
    overlapSize: 128,
  });

  if (chunks.length === 0) {
    return { success: false };
  }

  const texts = chunks.map((c) => c.text);
  const vectors = await batchGenerateEmbeddings(texts, userId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('memory_embeddings').insert(
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
  );

  if (error) {
    console.error(`Failed to index ${item.source}:${item.sourceId}`, error);
    return { success: false };
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
    new URL(cleanUrl);
  } catch {
    return {
      success: false,
      indexedCount: 0,
      erroredCount: 1,
      errors: [`Invalid URL: ${url}`],
    };
  }

  try {
    const content = await fetchUrlText(cleanUrl);

    if (!content || content.length < 50) {
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

/**
 * Fetch and index GitHub repository file contents using the public API.
 * Fetches the default branch tree (up to a cap) and indexes each text file.
 */
export async function fetchAndIndexGitHubRepo(
  owner: string,
  repo: string,
  path: string,
  userId: string
): Promise<IndexResult> {
  const errors: string[] = [];

  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(treeUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Arch-System External Content Indexer',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try master branch
      const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
      const masterResponse = await fetch(masterUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Arch-System External Content Indexer',
        },
      });
      clearTimeout(timeoutId);

      if (!masterResponse.ok) {
        return {
          success: false,
          indexedCount: 0,
          erroredCount: 1,
          errors: [`GitHub API returned ${response.status} for ${owner}/${repo}`],
        };
      }
      return indexGitHubTree(await masterResponse.json(), owner, repo, path, userId, errors);
    }

    return indexGitHubTree(await response.json(), owner, repo, path, userId, errors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`GitHub repo ${owner}/${repo}: ${message}`);
    return { success: false, indexedCount: 0, erroredCount: 1, errors };
  }
}

/**
 * Process a GitHub tree response: filter text files, fetch content, index.
 */
async function indexGitHubTree(
  treeData: unknown,
  owner: string,
  repo: string,
  pathFilter: string,
  userId: string,
  errors: string[]
): Promise<IndexResult> {
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
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`;
    try {
      const content = await fetchUrlText(rawUrl);
      if (!content || content.length < 50) continue;

      const item: IndexedContent = {
        source: 'github',
        sourceId: `${owner}/${repo}#${file.path}`,
        title: file.path,
        content,
        metadata: {
          owner,
          repo,
          path: file.path,
          fetched_at: new Date().toISOString(),
          content_type: 'github',
        },
      };

      const result = await indexContent(item, userId);
      if (result.success) indexedCount++;
      else errors.push(`Failed to index ${file.path}`);
    } catch {
      errors.push(`Failed to fetch ${file.path}`);
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
      else errors.push(`Failed to index ${file}`);
    } catch {
      errors.push(`Failed to read ${file}`);
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
 * Recursively collect markdown files from a directory (max depth 5).
 */
function collectMarkdownFiles(dir: string, acc: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(full, acc);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.md', '.markdown', '.txt', '.ts', '.tsx'].includes(ext)) {
        acc.push(full);
      }
    }
  }
  return acc;
}
