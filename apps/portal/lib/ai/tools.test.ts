import { machineStatusTool, shiftLogsTool, delaysTool, aiTools } from "./tools";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock(
  "@repo/supabase/server",
);

function buildSupabase(deptData: unknown, tableData: unknown = []) {
  const mockSingle = jest.fn().mockResolvedValue({ data: deptData });
  const mockGetAll = jest.fn().mockResolvedValue({ data: tableData });

  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === "departments") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: mockSingle }),
        }),
      };
    }
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: tableData }),
          mockResolvedValue: mockGetAll,
        }),
      }),
    };
  });

  createServerSupabaseClient.mockResolvedValue({ from: fromMock });
  return { fromMock, mockSingle };
}

describe("aiTools export", () => {
  it("exports machineStatus, shiftLogs, and delays keys", () => {
    expect(aiTools).toHaveProperty("machineStatus");
    expect(aiTools).toHaveProperty("shiftLogs");
    expect(aiTools).toHaveProperty("delays");
  });

  it("each tool has a description", () => {
    expect(typeof machineStatusTool.description).toBe("string");
    expect(machineStatusTool.description!.length).toBeGreaterThan(0);
    expect(typeof shiftLogsTool.description).toBe("string");
    expect(typeof delaysTool.description).toBe("string");
  });

  it("each tool has an inputSchema", () => {
    expect(machineStatusTool.inputSchema).toBeDefined();
    expect(shiftLogsTool.inputSchema).toBeDefined();
    expect(delaysTool.inputSchema).toBeDefined();
  });

  it("each tool has an execute function", () => {
    expect(typeof machineStatusTool.execute).toBe("function");
    expect(typeof shiftLogsTool.execute).toBe("function");
    expect(typeof delaysTool.execute).toBe("function");
  });
});

describe("machineStatusTool.execute", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns error when department not found", async () => {
    buildSupabase(null);
    const result = await (machineStatusTool.execute as Function)({
      departmentName: "unknown",
    });
    expect(result).toEqual({ error: "Department not found" });
  });

  it("queries machines for found department", async () => {
    const { fromMock } = buildSupabase({ id: "dept-1" }, [
      {
        id: "m-1",
        name: "Excavator A",
        machine_type: "excavator",
        active: true,
      },
    ]);

    const result = await (machineStatusTool.execute as Function)({
      departmentName: "drilling",
    });

    expect(fromMock).toHaveBeenCalledWith("departments");
    expect(fromMock).toHaveBeenCalledWith("machines");
    expect(result).toHaveProperty("machines");
  });
});

describe("shiftLogsTool.execute", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns error when department not found", async () => {
    buildSupabase(null);
    const result = await (shiftLogsTool.execute as Function)({
      departmentName: "unknown",
    });
    expect(result).toEqual({ error: "Department not found" });
  });

  it("queries daily_logs for found department", async () => {
    const { fromMock } = buildSupabase({ id: "dept-1" }, []);
    await (shiftLogsTool.execute as Function)({ departmentName: "drilling" });
    expect(fromMock).toHaveBeenCalledWith("departments");
    expect(fromMock).toHaveBeenCalledWith("daily_logs");
  });

  it("accepts optional date parameter", async () => {
    buildSupabase({ id: "dept-1" }, []);
    const result = await (shiftLogsTool.execute as Function)({
      departmentName: "drilling",
      date: "2026-05-17",
    });
    expect(result).toHaveProperty("logs");
  });
});

describe("delaysTool.execute", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns error when department not found", async () => {
    buildSupabase(null);
    const result = await (delaysTool.execute as Function)({
      departmentName: "unknown",
    });
    expect(result).toEqual({ error: "Department not found" });
  });

  it("queries operational_delays for found department", async () => {
    const { fromMock } = buildSupabase({ id: "dept-1" }, []);
    await (delaysTool.execute as Function)({ departmentName: "drilling" });
    expect(fromMock).toHaveBeenCalledWith("departments");
    expect(fromMock).toHaveBeenCalledWith("operational_delays");
  });

  it("accepts optional date parameter", async () => {
    buildSupabase({ id: "dept-1" }, []);
    const result = await (delaysTool.execute as Function)({
      departmentName: "drilling",
      date: "2026-05-17",
    });
    expect(result).toHaveProperty("delays");
  });
});
