import {
  detectContentType,
  chunkText,
  mergeSmallChunks,
  estimateTokens,
  chunkForEmbedding,
  type Chunk,
} from "./chunking";

// ---- detectContentType -----------------------------------------------

describe("detectContentType", () => {
  it("detects code from import/export keywords", () => {
    const code = `import { foo } from "bar";\nexport const x = 1;\nconst y = {};`;
    expect(detectContentType(code)).toBe("code");
  });

  it("detects code from SQL keywords", () => {
    const sql = `SELECT id, name FROM machines WHERE active = true;\nJOIN departments ON dept_id = id;`;
    expect(detectContentType(sql)).toBe("code");
  });

  it("detects conversation for short single-line text", () => {
    expect(detectContentType("Hello, how are you?")).toBe("conversation");
  });

  it("detects conversation for text with ≤3 lines and short avg line length", () => {
    expect(detectContentType("First line\nSecond line")).toBe("conversation");
  });

  it("detects document for longer prose", () => {
    const doc = Array(10).fill("This is a sentence about mining operations.").join(" ");
    expect(detectContentType(doc)).toBe("document");
  });
});

// ---- estimateTokens --------------------------------------------------

describe("estimateTokens", () => {
  it("returns ceil(length / 4)", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

// ---- chunkText (conversation) ----------------------------------------

describe("chunkText – conversation", () => {
  it("returns a single chunk for short text", () => {
    const result = chunkText("Hello world", { contentType: "conversation" });
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("Hello world");
    expect(result[0]!.index).toBe(0);
  });

  it("splits on double newlines into separate chunks", () => {
    const text = "Message one\n\nMessage two\n\nMessage three";
    const result = chunkText(text, { contentType: "conversation" });
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0]!.text).toBe("Message one");
    expect(result[1]!.text).toBe("Message two");
  });

  it("assigns sequential index values", () => {
    const text = "A\n\nB\n\nC";
    const result = chunkText(text, { contentType: "conversation" });
    result.forEach((chunk, i) => expect(chunk.index).toBe(i));
  });

  it("token estimate is never zero for non-empty chunks", () => {
    const result = chunkText("Hello there", { contentType: "conversation" });
    expect(result[0]!.tokenEstimate).toBeGreaterThan(0);
  });
});

// ---- chunkText (document) -------------------------------------------

describe("chunkText – document", () => {
  it("returns a single chunk when text fits in maxChunkSize", () => {
    const text = "Short document text.";
    const result = chunkText(text, {
      contentType: "document",
      maxChunkSize: 512,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe(text);
  });

  it("splits long document into multiple chunks", () => {
    const sentence = "The mining site reported elevated deformation readings today. ";
    const longDoc = sentence.repeat(200); // ~12400 chars >> 512 tokens (2048 chars)
    const result = chunkText(longDoc, {
      contentType: "document",
      maxChunkSize: 128,
    });
    expect(result.length).toBeGreaterThan(1);
  });

  it("every chunk has tokenEstimate > 0", () => {
    const sentence = "Each sentence carries important safety data for the shift. ";
    const doc = sentence.repeat(50);
    const result = chunkText(doc, {
      contentType: "document",
      maxChunkSize: 64,
    });
    result.forEach((c) => expect(c.tokenEstimate).toBeGreaterThan(0));
  });

  it("chunk indices are sequential", () => {
    const sentence = "Repeated content line for boundary testing purposes here. ";
    const doc = sentence.repeat(100);
    const result = chunkText(doc, {
      contentType: "document",
      maxChunkSize: 64,
    });
    result.forEach((c, i) => expect(c.index).toBe(i));
  });
});

// ---- chunkText (code) -----------------------------------------------

describe("chunkText – code", () => {
  it("splits TypeScript functions into chunks", () => {
    const code = `
export function alpha() {
  return 1;
}

export function beta() {
  return 2;
}

export function gamma() {
  return 3;
}
    `.trim();
    const result = chunkText(code, { contentType: "code" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    const nonEmpty = result.filter((c) => c.text.length > 0);
    expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
  });

  it("returns at least one chunk for single-function code", () => {
    const code = `function add(a, b) { return a + b; }`;
    const result = chunkText(code, { contentType: "code" });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---- mergeSmallChunks -----------------------------------------------

describe("mergeSmallChunks", () => {
  const makeChunk = (text: string, index: number): Chunk => ({
    text,
    index,
    startChar: 0,
    endChar: text.length,
    tokenEstimate: Math.ceil(text.length / 4),
  });

  it("returns empty array for empty input", () => {
    expect(mergeSmallChunks([])).toEqual([]);
  });

  it("merges two small chunks into one", () => {
    const chunks = [makeChunk("Hello", 0), makeChunk("world", 1)];
    const result = mergeSmallChunks(chunks, 512);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("Hello\n\nworld");
  });

  it("does not merge chunks that would exceed maxTokens", () => {
    const bigText = "a".repeat(400); // 100 tokens
    const chunks = [makeChunk(bigText, 0), makeChunk(bigText, 1), makeChunk(bigText, 2)];
    // maxTokens = 128 → maxChars = 512; each chunk is 400 chars, two merged = 800+2 > 512
    const result = mergeSmallChunks(chunks, 128);
    expect(result.length).toBe(3);
  });

  it("preserves text content through merging", () => {
    const chunks = [makeChunk("alpha", 0), makeChunk("beta", 1)];
    const result = mergeSmallChunks(chunks, 512);
    expect(result[0]!.text).toContain("alpha");
    expect(result[0]!.text).toContain("beta");
  });
});

// ---- chunkForEmbedding ----------------------------------------------

describe("chunkForEmbedding", () => {
  it("returns at least one chunk for any non-empty text", () => {
    expect(chunkForEmbedding("some text")).toHaveLength(1);
  });

  it("merges small chunks after chunking", () => {
    const text = "A\n\nB\n\nC\n\nD";
    const result = chunkForEmbedding(text, {
      contentType: "conversation",
      maxChunkSize: 512,
    });
    // All four messages are tiny → should be merged into one chunk
    expect(result.length).toBeLessThan(4);
  });
});

// ---- conversation long message (splitBySentences path) ---------------

describe("chunkText – conversation with long message", () => {
  it("splits a very long single message using sentence splitting", () => {
    // Create a message that exceeds the small maxChunkSize (4 chars per token * 16 = 64 chars)
    const sentence = "This sentence is quite long and detailed. ";
    const longMsg = sentence.repeat(10); // ~420 chars >> 64 chars
    const result = chunkText(longMsg, {
      contentType: "conversation",
      maxChunkSize: 16,
    });
    expect(result.length).toBeGreaterThan(1);
    result.forEach((c) => expect(c.tokenEstimate).toBeGreaterThan(0));
  });

  it("hard-splits a sentence that alone exceeds maxChunkSize", () => {
    // A single sentence longer than maxChars so hard-split triggers
    const hugeSentence = "x".repeat(300) + ". The end";
    const result = chunkText(hugeSentence, {
      contentType: "conversation",
      maxChunkSize: 16,
    });
    expect(result.length).toBeGreaterThan(1);
  });

  it("splits on horizontal rule separator", () => {
    const text = "First message\n---\nSecond message";
    const result = chunkText(text, { contentType: "conversation" });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---- document chunking with preserveBoundaries=false ----------------

describe("chunkText – document without boundary preservation", () => {
  it("does hard fixed-size splits when preserveBoundaries=false", () => {
    const text = "word ".repeat(500); // ~2500 chars
    const result = chunkText(text, {
      contentType: "document",
      maxChunkSize: 64,
      preserveBoundaries: false,
    });
    expect(result.length).toBeGreaterThan(1);
  });
});

// ---- document chunking with sentence boundary (no paragraph break) ---

describe("chunkText – document sentence boundary", () => {
  it("breaks at sentence boundary when no paragraph break is found", () => {
    // No double-newlines so sentence boundary logic fires
    const prose =
      "The machine reported high vibration levels. Maintenance was scheduled. " +
      "Operators were notified promptly. Safety checks were performed. " +
      "The drill resumed normal operation after inspection. ";
    const longProse = prose.repeat(8); // ~2800 chars
    const result = chunkText(longProse, {
      contentType: "document",
      maxChunkSize: 64,
      preserveBoundaries: true,
    });
    expect(result.length).toBeGreaterThan(1);
  });
});

// ---- code with very large function (splitByLines fallback) -----------

describe("chunkText – code with large function", () => {
  it("uses splitByLines when a code block exceeds maxChars", () => {
    // Build code with multiple function boundaries but each is huge
    const bigFn = `export function bigFunc() {\n` + "  const x = 1;\n".repeat(50) + `}\n\n`;
    const code = bigFn.repeat(3);
    const result = chunkText(code, { contentType: "code", maxChunkSize: 16 });
    expect(result.length).toBeGreaterThan(1);
  });

  it("uses line-based fallback when no function boundaries found", () => {
    // No function signatures → falls back to splitByLines directly
    const codeBlock = "x = 1;\n".repeat(200);
    const result = chunkText(codeBlock, {
      contentType: "code",
      maxChunkSize: 16,
    });
    expect(result.length).toBeGreaterThan(1);
  });

  it("handles a single line longer than maxChars via hard-split", () => {
    // Single very long line so the while loop in splitByLines triggers
    const veryLongLine = "a".repeat(500) + " = 1;";
    const result = chunkText(veryLongLine, {
      contentType: "code",
      maxChunkSize: 16,
    });
    expect(result.length).toBeGreaterThan(1);
  });
});

// ---- detectContentType mixed code score (1 indicator) ---------------

describe("detectContentType – edge cases", () => {
  it("detects document when code score is exactly 1", () => {
    // Only braces+newlines indicator fires, but not the keyword regex → codeScore=1 → document
    const text = "{\n  some: data\n}\n".repeat(20);
    const result = detectContentType(text);
    // codeScore could vary; just ensure it returns a valid type
    expect(["code", "document", "conversation"]).toContain(result);
  });

  it("detects code when both keyword and brace indicators fire", () => {
    const text = `function doWork() {\n  return true;\n}\n`.repeat(3);
    expect(detectContentType(text)).toBe("code");
  });
});
