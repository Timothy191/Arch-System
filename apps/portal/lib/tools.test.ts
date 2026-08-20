import { getTools } from "./tools";
import { PRODUCTIVITY_TOOLS } from "@repo/departments/data-access";

const mockFrom = jest.fn();
jest.mock("@repo/supabase/read-replica", () => ({
  createReadReplicaClient: jest.fn(() => ({ from: mockFrom })),
}));

function mockQueryResult(result: { data: unknown; error: unknown }) {
  const mockOrder = jest.fn().mockResolvedValue(result);
  const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe("getTools", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("maps database rows into Tool objects", async () => {
    mockQueryResult({
      data: [
        {
          id: "t1",
          name: "tasks",
          display_name: "Tasks",
          description: "Manage to-dos",
          icon: "CheckSquare",
          color: "emerald",
        },
        {
          id: "t2",
          name: "documents",
          display_name: "Documents",
          description: "Shared files",
          icon: "FileText",
          color: "blue",
        },
      ],
      error: null,
    });

    const tools = await getTools();
    expect(tools).toEqual([
      {
        id: "t1",
        name: "tasks",
        displayName: "Tasks",
        description: "Manage to-dos",
        icon: "CheckSquare",
        color: "emerald",
      },
      {
        id: "t2",
        name: "documents",
        displayName: "Documents",
        description: "Shared files",
        icon: "FileText",
        color: "blue",
      },
    ]);
  });

  it("falls back to PRODUCTIVITY_TOOLS when the query errors", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockQueryResult({ data: null, error: new Error("db down") });

    const tools = await getTools();
    expect(tools).toHaveLength(PRODUCTIVITY_TOOLS.length);
    expect(tools[0]).toMatchObject({
      id: "0",
      name: PRODUCTIVITY_TOOLS[0]!.name,
      displayName: PRODUCTIVITY_TOOLS[0]!.displayName,
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("falls back to PRODUCTIVITY_TOOLS when the query returns no rows", async () => {
    mockQueryResult({ data: [], error: null });

    const tools = await getTools();
    expect(tools).toHaveLength(PRODUCTIVITY_TOOLS.length);
    expect(tools.map((t) => t.name)).toEqual(PRODUCTIVITY_TOOLS.map((t) => t.name));
  });
});

describe("EXTERNAL_TOOLS", () => {
  const originalFlowise = process.env.FLOWISE_URL;

  afterEach(() => {
    if (originalFlowise === undefined) delete process.env.FLOWISE_URL;
    else process.env.FLOWISE_URL = originalFlowise;
  });

  /** Re-evaluate the module so top-level EXTERNAL_TOOLS picks up current env vars. */
  function loadExternalTools() {
    let tools: { name: string; url: string }[] = [];
    jest.isolateModules(() => {
      const mod = require("./tools") as typeof import("./tools");
      tools = mod.EXTERNAL_TOOLS;
    });
    return tools;
  }

  it("defaults to local URLs", () => {
    delete process.env.FLOWISE_URL;
    const tools = loadExternalTools();
    expect(tools.find((t) => t.name === "flowise")?.url).toBe("http://localhost:3001");
  });

  it("honors environment variable overrides", () => {
    process.env.FLOWISE_URL = "https://flowise.example.com";
    const tools = loadExternalTools();
    expect(tools.find((t) => t.name === "flowise")?.url).toBe("https://flowise.example.com");
  });
});
