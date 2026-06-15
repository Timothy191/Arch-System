/**
 * @jest-environment node
 */
import {
  formatMemoriesForContext,
  storeMemory,
  storeMemories,
  retrieveRelevantMemories,
  retrieveSemanticMemories,
  getConversationHistory,
  getSemanticFact,
  storeSemanticFact,
  searchSemanticFacts,
  pruneEpisodicMemories,
  type MemoryEntry,
} from "./memory";
import { clearMemoryCache } from "@repo/redis/cache";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("./embeddings", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  batchGenerateEmbeddings: jest
    .fn()
    .mockResolvedValue([Array(768).fill(0.1), Array(768).fill(0.2)]),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "mem-1",
    session_id: "session-1",
    user_id: "user-1",
    content: "Test memory content",
    metadata: {},
    memory_type: "episodic",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const mock = {
    from: jest.fn(),
    rpc: jest.fn(),
    ...overrides,
  };
  createServerSupabaseClient.mockResolvedValue(mock);
  return mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearMemoryCache();
});

// ---------------------------------------------------------------------------
// formatMemoriesForContext
// ---------------------------------------------------------------------------

describe("formatMemoriesForContext", () => {
  it("returns empty string for empty memories array", () => {
    expect(formatMemoriesForContext([])).toBe("");
  });

  it("formats episodic memory with timestamp prefix", () => {
    const memories: MemoryEntry[] = [
      {
        id: "m1",
        sessionId: "s1",
        userId: "u1",
        content: "User mentioned shift start at 6am",
        metadata: {},
        memoryType: "episodic",
        createdAt: "2026-05-01T06:00:00Z",
      },
    ];
    const result = formatMemoriesForContext(memories);
    expect(result).toContain("User mentioned shift start at 6am");
    expect(result).toContain("Relevant context from memory:");
  });

  it("formats semantic memory with [semantic] prefix", () => {
    const memories: MemoryEntry[] = [
      {
        id: "m2",
        sessionId: "semantic",
        userId: "u1",
        content: "preferred_language: English",
        metadata: { fact_key: "preferred_language" },
        memoryType: "semantic",
        createdAt: "2026-05-01T00:00:00Z",
      },
    ];
    const result = formatMemoriesForContext(memories);
    expect(result).toContain("[semantic]");
    expect(result).toContain("preferred_language: English");
  });

  it("joins multiple memories with newlines", () => {
    const memories: MemoryEntry[] = [
      {
        id: "m1",
        sessionId: "s1",
        userId: "u1",
        content: "First memory",
        metadata: {},
        memoryType: "episodic",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m2",
        sessionId: "s1",
        userId: "u1",
        content: "Second memory",
        metadata: {},
        memoryType: "semantic",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = formatMemoriesForContext(memories);
    expect(result).toContain("First memory");
    expect(result).toContain("Second memory");
    const lines = result.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// storeMemory
// ---------------------------------------------------------------------------

describe("storeMemory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts memory and returns mapped entry", async () => {
    const row = makeRow();
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      }),
    });

    const result = await storeMemory({
      sessionId: "session-1",
      userId: "user-1",
      content: "Test memory content",
      memoryType: "episodic",
    });

    expect(result.id).toBe("mem-1");
    expect(result.content).toBe("Test memory content");
    expect(result.memoryType).toBe("episodic");
  });

  it("throws DatabaseError when insert fails", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "DB error" },
            }),
          }),
        }),
      }),
    });

    await expect(
      storeMemory({
        sessionId: "s1",
        userId: "u1",
        content: "fail",
        memoryType: "episodic",
      }),
    ).rejects.toThrow("Memory storage failed");
  });
});

// ---------------------------------------------------------------------------
// storeMemories
// ---------------------------------------------------------------------------

describe("storeMemories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty array for empty input", async () => {
    buildSupabaseMock({});
    const result = await storeMemories([]);
    expect(result).toEqual([]);
  });

  it("inserts multiple memories and returns mapped entries", async () => {
    const rows = [
      makeRow({ id: "m1", content: "First" }),
      makeRow({ id: "m2", content: "Second" }),
    ];
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    });

    const result = await storeMemories([
      {
        sessionId: "s1",
        userId: "u1",
        content: "First",
        memoryType: "episodic",
      },
      {
        sessionId: "s1",
        userId: "u1",
        content: "Second",
        memoryType: "semantic",
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("m1");
    expect(result[1]!.id).toBe("m2");
  });

  it("throws DatabaseError when batch insert fails", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Batch insert failed" },
          }),
        }),
      }),
    });

    await expect(
      storeMemories([
        {
          sessionId: "s1",
          userId: "u1",
          content: "test",
          memoryType: "episodic",
        },
      ]),
    ).rejects.toThrow("Batch memory storage failed");
  });
});

// ---------------------------------------------------------------------------
// retrieveRelevantMemories
// ---------------------------------------------------------------------------

describe("retrieveRelevantMemories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns mapped entries on successful hybrid search", async () => {
    const rpcRows = [
      {
        id: "m1",
        session_id: "s1",
        content: "Result",
        metadata: {},
        memory_type: "episodic",
        created_at: "2026-01-01T00:00:00Z",
        combined_score: 0.9,
      },
    ];
    buildSupabaseMock({
      rpc: jest.fn().mockResolvedValue({ data: rpcRows, error: null }),
    });

    const result = await retrieveRelevantMemories({
      userId: "u1",
      query: "test query",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("Result");
    expect(result[0]!.combinedScore).toBe(0.9);
  });

  it("falls back to semantic search when hybrid search fails", async () => {
    const semanticRows = [
      {
        id: "m2",
        session_id: "s1",
        content: "Semantic result",
        metadata: {},
        memory_type: "semantic",
        created_at: "2026-01-01T00:00:00Z",
        similarity: 0.8,
      },
    ];
    const supabase = buildSupabaseMock({
      rpc: jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Hybrid RPC failed" },
        })
        .mockResolvedValueOnce({ data: semanticRows, error: null }),
    });

    const result = await retrieveRelevantMemories({
      userId: "u1",
      query: "test",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(result[0]!.content).toBe("Semantic result");
  });
});

// ---------------------------------------------------------------------------
// retrieveSemanticMemories
// ---------------------------------------------------------------------------

describe("retrieveSemanticMemories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty array when semantic search fails", async () => {
    buildSupabaseMock({
      rpc: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: "RPC failed" } }),
    });

    const result = await retrieveSemanticMemories({
      userId: "u1",
      query: "test",
    });
    expect(result).toEqual([]);
  });

  it("passes through options to RPC call", async () => {
    const supabase = buildSupabaseMock({
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    await retrieveSemanticMemories({
      userId: "u1",
      query: "machine status",
      sessionId: "s1",
      memoryType: "episodic",
      limit: 5,
      similarityThreshold: 0.85,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "search_memories_semantic",
      expect.objectContaining({
        p_user_id: "u1",
        p_session_id: "s1",
        p_memory_type: "episodic",
        match_count: 5,
        similarity_threshold: 0.85,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getConversationHistory
// ---------------------------------------------------------------------------

describe("getConversationHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMemoryCache();
  });

  it("returns mapped conversation history from RPC", async () => {
    const rows = [
      {
        id: "m1",
        content: "User: hello",
        metadata: {},
        memory_type: "episodic",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    buildSupabaseMock({
      rpc: jest.fn().mockResolvedValue({ data: rows, error: null }),
    });

    const result = await getConversationHistory("session-1", "user-1");
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("User: hello");
    expect(result[0]!.memoryType).toBe("episodic");
  });

  it("falls back to direct DB query when RPC fails", async () => {
    const fallbackRows = [makeRow({ content: "Fallback entry" })];
    buildSupabaseMock({
      rpc: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: "RPC failed" } }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: fallbackRows }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await getConversationHistory(
      "session-fallback",
      "user-fallback",
    );
    expect(result[0]!.content).toBe("Fallback entry");
  });
});

// ---------------------------------------------------------------------------
// getSemanticFact
// ---------------------------------------------------------------------------

describe("getSemanticFact", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns content when fact found", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { content: "language: English" },
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await getSemanticFact("user-1", "preferred_language");
    expect(result).toBe("language: English");
  });

  it("returns null when fact not found", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await getSemanticFact("user-1", "nonexistent_key");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pruneEpisodicMemories
// ---------------------------------------------------------------------------

describe("pruneEpisodicMemories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns -1 on successful deletion (Supabase doesn't return count)", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await pruneEpisodicMemories("user-1", 90);
    expect(result).toBe(-1);
  });

  it("returns 0 when deletion fails", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest
                .fn()
                .mockResolvedValue({ error: { message: "DB error" } }),
            }),
          }),
        }),
      }),
    });

    const result = await pruneEpisodicMemories("user-1", 30);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// storeSemanticFact
// ---------------------------------------------------------------------------

describe("storeSemanticFact", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes existing fact and stores new one", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "memory_embeddings") {
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ error: null }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "mem-1", content: "language: English" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    });

    const result = await storeSemanticFact("user-1", "language", "English");
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// searchSemanticFacts
// ---------------------------------------------------------------------------

describe("searchSemanticFacts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns relevant semantic memories", async () => {
    const mockFacts: MemoryEntry[] = [
      {
        id: "m1",
        sessionId: "semantic",
        userId: "user-1",
        content: "language: English",
        memoryType: "semantic",
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    buildSupabaseMock({
      rpc: jest.fn().mockResolvedValue({ data: mockFacts, error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest
                  .fn()
                  .mockResolvedValue({ data: mockFacts, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await searchSemanticFacts("user-1", "language");
    expect(Array.isArray(result)).toBe(true);
  });
});
