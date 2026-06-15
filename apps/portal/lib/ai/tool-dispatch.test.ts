import { dispatchTool, formatToolDescriptions } from "./tool-dispatch";
import { OLLAMA_URL } from "./ollama";

const mockFetch = jest.fn() as jest.MockedFunction<typeof globalThis.fetch>;
globalThis.fetch = mockFetch;

// Mock logger to keep test output clean
jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

// Mock AI tools with known fixtures
jest.mock("./tools", () => {
  const zod = jest.requireActual("zod");
  const machineStatusSchema = zod.object({
    machineId: zod.string().describe("Machine identifier"),
  });

  return {
    aiTools: {
      machineStatus: {
        description: "Get the status of a specific machine",
        inputSchema: machineStatusSchema,
        execute: jest.fn(),
      },
      fleetStatus: {
        description: "Get a summary of all machines in the fleet",
        inputSchema: zod.object({}),
        execute: jest.fn(),
      },
    },
  };
});

// Mock prompts
jest.mock("./prompts", () => ({
  systemPrompts: {
    toolDispatch: "You are a tool dispatch router.",
  },
}));

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function mockOllamaResponse(
  overrides: Partial<{
    toolCalls: unknown[] | null;
    content: string;
    ok: boolean;
  }> = {},
) {
  const defaults = { ok: true, toolCalls: [], content: "" };
  const cfg = { ...defaults, ...overrides };

  mockFetch.mockResolvedValueOnce({
    ok: cfg.ok,
    json: async () => ({
      message: {
        tool_calls: cfg.toolCalls,
        content: cfg.content,
      },
    }),
  } as Response);
}

function mockOllamaError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: "Internal server error" }),
  } as Response);
}

function mockOllamaNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("dispatchTool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("empty / invalid input", () => {
    it("returns null for empty string", async () => {
      const result = await dispatchTool("");
      expect(result).toBeNull();
    });

    it("returns null for whitespace-only string", async () => {
      const result = await dispatchTool("   ");
      expect(result).toBeNull();
    });

    it("returns null for undefined/null (typed as string)", async () => {
      const r1 = await dispatchTool(null as unknown as string);
      expect(r1).toBeNull();
      const r2 = await dispatchTool(undefined as unknown as string);
      expect(r2).toBeNull();
    });
  });

  describe("native Ollama tool calling (primary tier)", () => {
    it("returns tool with confidence 5 when Ollama returns a native tool call", async () => {
      mockOllamaResponse({
        toolCalls: [
          {
            function: {
              name: "machineStatus",
              arguments: JSON.stringify({ machineId: "M-001" }),
            },
          },
        ],
      });

      const result = await dispatchTool("check machine M-001");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("machineStatus");
      expect(result!.args).toEqual({ machineId: "M-001" });
      expect(result!.confidence).toBe(5);
    });

    it("handles string arguments that need JSON parsing", async () => {
      mockOllamaResponse({
        toolCalls: [
          {
            function: {
              name: "machineStatus",
              arguments: JSON.stringify({ machineId: "M-002" }),
            },
          },
        ],
      });

      const result = await dispatchTool("status of M-002");
      expect(result).not.toBeNull();
      expect(result!.args).toEqual({ machineId: "M-002" });
    });

    it("ignores unknown tool names from native calls (falls through to JSON)", async () => {
      mockOllamaResponse({
        toolCalls: [
          {
            function: {
              name: "unknownTool",
              arguments: "{}",
            },
          },
        ],
      });

      // First call returns native with unknown tool — falls through
      // Second call (JSON fallback) also returns null
      mockOllamaError(500);

      const result = await dispatchTool("do something");
      expect(result).toBeNull();
    });

    it("falls through to JSON tier when native tier returns no tool_calls", async () => {
      // Native tier: no tool_calls
      mockOllamaResponse({ toolCalls: null, content: "No tool needed." });
      // JSON fallback: returns a valid result
      mockOllamaResponse({
        content: JSON.stringify({
          tool: null,
          confidence: 5,
          reason: "User is just greeting, no tool needed",
        }),
      });

      const result = await dispatchTool("hello");
      expect(result).not.toBeNull();
      expect(result!.tool).toBeNull();
      expect(result!.confidence).toBe(5);
    });
  });

  describe("JSON fallback dispatch (secondary tier)", () => {
    it("parses raw JSON from Ollama response", async () => {
      // Native fails
      mockOllamaResponse({ toolCalls: null, content: "" });
      // JSON fallback succeeds
      mockOllamaResponse({
        content: JSON.stringify({
          tool: "fleetStatus",
          args: {},
          confidence: 4,
          reason: "User wants fleet overview",
        }),
      });

      const result = await dispatchTool("show all machines");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("fleetStatus");
      expect(result!.confidence).toBe(4);
    });

    it("parses JSON wrapped in markdown code fences", async () => {
      mockOllamaResponse({ toolCalls: null, content: "" });
      mockOllamaResponse({
        content: [
          "Based on the query, I recommend:",
          "```json",
          JSON.stringify({
            tool: "machineStatus",
            args: { machineId: "M-003" },
            confidence: 5,
            reason: "User explicitly requested machine M-003 status",
          }),
          "```",
        ].join("\n"),
      });

      const result = await dispatchTool("status of M-003");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("machineStatus");
      expect(result!.args).toEqual({ machineId: "M-003" });
    });

    it("uses defaults when JSON is missing optional fields", async () => {
      mockOllamaResponse({ toolCalls: null, content: "" });
      mockOllamaResponse({
        content: JSON.stringify({ tool: "fleetStatus" }),
      });

      const result = await dispatchTool("fleet status");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("fleetStatus");
      expect(result!.confidence).toBe(5); // default
      expect(result!.reason).toBe(""); // default
      expect(result!.args).toEqual({}); // default
    });

    it("returns low confidence (1) for unknown tool name", async () => {
      mockOllamaResponse({ toolCalls: null, content: "" });
      mockOllamaResponse({
        content: JSON.stringify({
          tool: "nonExistentTool",
          confidence: 5,
          reason: "User wants something",
        }),
      });

      const result = await dispatchTool("do magic");
      expect(result).not.toBeNull();
      expect(result!.tool).toBeNull();
      expect(result!.confidence).toBe(1);
    });

    it("returns low confidence when confidence field is explicitly <=2", async () => {
      mockOllamaResponse({ toolCalls: null, content: "" });
      mockOllamaResponse({
        content: JSON.stringify({
          tool: "fleetStatus",
          confidence: 2,
          reason:
            "User mention is vague, could refer to fleet or individual machines",
        }),
      });

      const result = await dispatchTool("machines");
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(2);
      expect(result!.tool).not.toBeNull(); // tool is set but caller will gate on confidence
    });
  });

  describe("both tiers fail", () => {
    it("returns null when native returns error and JSON returns error", async () => {
      mockOllamaError(503);
      mockOllamaError(500);

      const result = await dispatchTool("check machines");
      expect(result).toBeNull();
    });

    it("returns null when native times out and JSON is malformed", async () => {
      mockOllamaNetworkError();
      mockOllamaResponse({
        content: "This is not JSON {{broken",
      });

      const result = await dispatchTool("check machines");
      expect(result).toBeNull();
    });

    it("returns null when both tiers return network errors", async () => {
      mockOllamaNetworkError();
      mockOllamaNetworkError();

      const result = await dispatchTool("check machines");
      expect(result).toBeNull();
    });

    it("returns null when native returns not-ok but check passes content", async () => {
      // First call: native tier returns HTTP error
      mockOllamaError(503);
      // Second call: JSON tier returns valid JSON with no tool needed
      mockOllamaResponse({
        content: JSON.stringify({
          tool: null,
          confidence: 5,
          reason: "User is greeting, no tool required",
        }),
      });

      const result = await dispatchTool("hello");
      expect(result).not.toBeNull();
      expect(result!.tool).toBeNull();
      expect(result!.confidence).toBe(5);
    });
  });

  describe("fetch call behavior", () => {
    it("calls the correct Ollama endpoint", async () => {
      mockOllamaResponse();
      mockOllamaResponse();

      await dispatchTool("test");
      const calls = mockFetch.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const firstCall = calls[0]![0] as string;
      expect(firstCall).toBe(`${OLLAMA_URL}/api/chat`);
    });

    it("sends POST with JSON body", async () => {
      mockOllamaResponse();
      mockOllamaResponse();

      await dispatchTool("test");
      const call = mockFetch.mock.calls[0]!;
      expect(call[1]).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// formatToolDescriptions
// ────────────────────────────────────────────────────────────────────────────

describe("formatToolDescriptions", () => {
  it("returns a string listing all tools with their parameters", () => {
    const result = formatToolDescriptions();
    expect(result).toContain("machineStatus");
    expect(result).toContain("fleetStatus");
    expect(result).toContain("machineId");
  });

  it("separates tools with newlines", () => {
    const result = formatToolDescriptions();
    const lines = result.split("\n");
    expect(lines.length).toBe(2); // two tools
  });
});
