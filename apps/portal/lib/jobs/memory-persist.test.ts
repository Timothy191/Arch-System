const mockLogError = jest.fn();
jest.mock("@/lib/errors/error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockFrom = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((_opts: unknown, handler: unknown) => ({ handler })),
  },
  aiMemoryPersistEvent: "ai/memory-persist",
}));

import { memoryPersistFn } from "./memory-persist";

function mockMemoriesQuery(result: { data: unknown; error: unknown }) {
  const mockLimit = jest.fn().mockResolvedValue(result);
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockSecondEq = jest.fn().mockReturnValue({ order: mockOrder });
  const mockFirstEq = jest.fn().mockReturnValue({ eq: mockSecondEq });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockFirstEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

const handler = (memoryPersistFn as any).handler;

describe("memoryPersistFn", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockLogError.mockClear();
  });

  it("skips work when the assistant response was already stored", async () => {
    const result = await handler({
      event: { data: { sessionId: "s1", userId: "u1", assistantResponseStored: true } },
    });
    expect(result).toEqual({ success: true, skipped: "already_stored" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reports recovery when assistant episodic memories exist", async () => {
    mockMemoriesQuery({
      data: [
        { id: "m1", content: "Assistant: summary of the session", memory_type: "episodic" },
        { id: "m2", content: "Assistant: follow-up", memory_type: "episodic" },
        { id: "m3", content: "User: another question", memory_type: "episodic" },
      ],
      error: null,
    });

    const result = await handler({
      event: { data: { sessionId: "s1", userId: "u1", assistantResponseStored: false } },
    });
    expect(result).toEqual({ success: true, recovered: true, count: 2 });
    expect(mockFrom).toHaveBeenCalledWith("memory_embeddings");
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("logs and returns recovered:false when no assistant memory was persisted", async () => {
    mockMemoriesQuery({
      data: [{ id: "m1", content: "User: hello", memory_type: "episodic" }],
      error: null,
    });

    const result = await handler({
      event: { data: { sessionId: "s1", userId: "u1", assistantResponseStored: false } },
    });
    expect(result).toEqual({ success: true, recovered: false });
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "memory_persist_job" }),
    );
  });

  it("re-throws and logs when the memory query fails", async () => {
    mockMemoriesQuery({ data: null, error: { message: "connection reset" } });

    await expect(
      handler({
        event: { data: { sessionId: "s1", userId: "u1", assistantResponseStored: false } },
      }),
    ).rejects.toThrow("Failed to query session memories");
    expect(mockLogError).toHaveBeenCalled();
  });
});
