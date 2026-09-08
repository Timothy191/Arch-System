/**
 * Chunking strategies for different content types.
 *
 * Strategy selection:
 * - Conversational: whole-message (messages are naturally short)
 * - Document: semantic chunking with sentence boundaries + overlap
 * - Code: function/method-level via heuristics, fallback to fixed-size
 * - Mixed: auto-detect content type and apply best strategy
 *
 * Token estimates use ~4 chars/token (conservative for English text).
 */

type ContentType = "conversation" | "document" | "code" | "mixed";

interface ChunkOptions {
  contentType?: ContentType;
  maxChunkSize?: number; // in tokens, default 512
  overlapSize?: number; // in tokens, default 128
  preserveBoundaries?: boolean; // keep sentences/paragraphs intact
}

export interface Chunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  tokenEstimate: number;
}

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 128;
const CHARS_PER_TOKEN = 4;

/**
 * Auto-detect content type from text characteristics.
 */
export function detectContentType(text: string): ContentType {
  const codeIndicators = [
    /^(import|export|const|let|var|function|class|interface|type|return|if|for|while|async|await|def|class)\b/m,
    /[{};]/.test(text) && /\n/.test(text),
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im,
  ];

  const codeScore = codeIndicators.filter((r) =>
    typeof r === "boolean" ? r : r.test(text)
  ).length;

  if (codeScore >= 2) return "code";

  // Check for conversational patterns
  const lineCount = text.split("\n").length;
  const avgLineLength = text.length / Math.max(lineCount, 1);
  if (lineCount <= 3 && avgLineLength < 200) return "conversation";

  return "document";
}

/**
 * Main chunking entry point. Selects strategy based on content type.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const contentType = options.contentType ?? detectContentType(text);

  switch (contentType) {
    case "conversation":
      return chunkConversation(text, options);
    case "document":
      return chunkDocument(text, options);
    case "code":
      return chunkCode(text, options);
    default:
      return chunkDocument(text, options);
  }
}

/**
 * Conversation chunking: split by message boundaries (newlines or delimiters).
 * Each chunk is a complete message unless it exceeds max size.
 */
function chunkConversation(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxChunkSize ?? DEFAULT_MAX_TOKENS;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // Split on double newlines or markdown horizontal rules (common message separators)
  const messages = text.split(/\n\n+|\n---\n/).filter((m) => m.trim().length > 0);

  const chunks: Chunk[] = [];
  let charOffset = 0;

  for (let i = 0; i < messages.length; i++) {
    const raw = messages[i];
    if (!raw) continue;
    const msg = raw.trim();
    if (msg.length === 0) continue;

    if (msg.length <= maxChars) {
      chunks.push({
        text: msg,
        index: chunks.length,
        startChar: charOffset,
        endChar: charOffset + msg.length,
        tokenEstimate: Math.ceil(msg.length / CHARS_PER_TOKEN),
      });
      charOffset += msg.length + 2; // +2 for separator
    } else {
      // Message too long, fallback to sentence splitting
      const subChunks = splitBySentences(msg, maxChars);
      for (const sub of subChunks) {
        chunks.push({
          text: sub,
          index: chunks.length,
          startChar: charOffset,
          endChar: charOffset + sub.length,
          tokenEstimate: Math.ceil(sub.length / CHARS_PER_TOKEN),
        });
        charOffset += sub.length;
      }
    }
  }

  return chunks;
}

/**
 * Document chunking: semantic chunking by paragraphs/sentences with overlap.
 */
function chunkDocument(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxChunkSize ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options.overlapSize ?? DEFAULT_OVERLAP_TOKENS;
  const preserveBoundaries = options.preserveBoundaries ?? true;

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) {
    return [
      {
        text,
        index: 0,
        startChar: 0,
        endChar: text.length,
        tokenEstimate: Math.ceil(text.length / CHARS_PER_TOKEN),
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (preserveBoundaries && end < text.length) {
      // Try to break at paragraph boundary
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + maxChars * 0.5) {
        end = paragraphBreak + 2;
      } else {
        // Try sentence boundary
        const sentenceBreak = findSentenceBoundary(text, end);
        if (sentenceBreak > start + maxChars * 0.5) {
          end = sentenceBreak;
        }
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
        startChar: start,
        endChar: end,
        tokenEstimate: Math.ceil(chunkText.length / CHARS_PER_TOKEN),
      });
    }

    // Move start forward, accounting for overlap
    start = Math.max(end - overlapChars, start + 1);
    if (start >= end) start = end;
  }

  return chunks;
}

/**
 * Code chunking: split by function/method/class boundaries, fallback to fixed-size blocks.
 */
function chunkCode(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxChunkSize ?? DEFAULT_MAX_TOKENS;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // Try to split on function/class boundaries first
  const functionPattern =
    /^(export\s+)?(async\s+)?(function|const|let|var|class|interface|type)\s+\w+.*\{?\s*\n/gm;

  const boundaries: number[] = [0];
  let match;
  while ((match = functionPattern.exec(text)) !== null) {
    boundaries.push(match.index);
  }
  boundaries.push(text.length);

  // If we found meaningful boundaries and they're not too large, use them
  const avgBoundarySize = text.length / Math.max(boundaries.length - 1, 1);
  if (boundaries.length > 2 && avgBoundarySize < maxChars * 1.5) {
    const chunks: Chunk[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i] ?? 0;
      const end = boundaries[i + 1] ?? text.length;
      const chunkText = text.slice(start, end).trim();

      if (chunkText.length <= maxChars) {
        chunks.push({
          text: chunkText,
          index: chunks.length,
          startChar: start,
          endChar: end,
          tokenEstimate: Math.ceil(chunkText.length / CHARS_PER_TOKEN),
        });
      } else {
        // Function too long, fallback to sentence/line splitting
        const subChunks = splitByLines(chunkText, maxChars);
        let subOffset = start;
        for (const sub of subChunks) {
          chunks.push({
            text: sub,
            index: chunks.length,
            startChar: subOffset,
            endChar: subOffset + sub.length,
            tokenEstimate: Math.ceil(sub.length / CHARS_PER_TOKEN),
          });
          subOffset += sub.length;
        }
      }
    }
    return chunks;
  }

  // Fallback to line-based fixed-size chunking
  return splitByLines(text, maxChars).map((chunk, index, all) => ({
    text: chunk,
    index,
    startChar: all.slice(0, index).reduce((sum, c) => sum + c.length, 0),
    endChar: all.slice(0, index + 1).reduce((sum, c) => sum + c.length, 0),
    tokenEstimate: Math.ceil(chunk.length / CHARS_PER_TOKEN),
  }));
}

// ============================================
// Boundary Detection Helpers
// ============================================

function findSentenceBoundary(text: string, targetIndex: number): number {
  // Look for sentence-ending punctuation followed by space or newline
  const searchStart = Math.max(0, targetIndex - 200);
  const searchText = text.slice(searchStart, targetIndex + 50);

  // Find last sentence end before target
  const sentenceEnds = /[.!?](\s+|$)/g;
  let lastEnd = -1;
  let match;

  while ((match = sentenceEnds.exec(searchText)) !== null) {
    const absPos = searchStart + match.index + match[0].length;
    if (absPos <= targetIndex) {
      lastEnd = absPos;
    }
  }

  return lastEnd > 0 ? lastEnd : targetIndex;
}

function splitBySentences(text: string, maxChars: number): string[] {
  const sentences: string[] = [];
  const rawSentences = text.split(/(?<=[.!?])\s+/);

  let current = "";
  for (const sentence of rawSentences) {
    if (current.length + sentence.length < maxChars) {
      current += (current ? " " : "") + sentence;
    } else {
      if (current) sentences.push(current);
      current = sentence;
      // If single sentence exceeds max, hard split
      while (current.length > maxChars) {
        sentences.push(current.slice(0, maxChars));
        current = current.slice(maxChars);
      }
    }
  }
  if (current) sentences.push(current);

  return sentences.filter((s) => s.trim().length > 0);
}

function splitByLines(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 < maxChars) {
      current += (current ? "\n" : "") + line;
    } else {
      if (current) chunks.push(current);
      current = line;
      // If single line exceeds max, hard split
      while (current.length > maxChars) {
        chunks.push(current.slice(0, maxChars));
        current = current.slice(maxChars);
      }
    }
  }
  if (current) chunks.push(current);

  return chunks.filter((c) => c.trim().length > 0);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Merge small chunks to reduce embedding API calls.
 */
export function mergeSmallChunks(chunks: Chunk[], maxTokens = 512): Chunk[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const merged: Chunk[] = [];
  let current: Chunk | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
    } else if (current.text.length + chunk.text.length + 2 <= maxChars) {
      current.text += "\n\n" + chunk.text;
      current.endChar = chunk.endChar;
      current.tokenEstimate = Math.ceil(current.text.length / CHARS_PER_TOKEN);
    } else {
      merged.push(current);
      current = { ...chunk };
    }
  }

  if (current) merged.push(current);
  return merged;
}

/**
 * Estimate token count for a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Chunk and prepare for embedding in one step.
 * Returns chunks ready for batch embedding.
 */
export function chunkForEmbedding(text: string, options?: ChunkOptions): Chunk[] {
  const chunks = chunkText(text, options);
  return mergeSmallChunks(chunks, options?.maxChunkSize ?? DEFAULT_MAX_TOKENS);
}
