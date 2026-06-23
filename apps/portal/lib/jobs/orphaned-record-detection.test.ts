import { orphanedRecordDetectionFn } from "./orphaned-record-detection";
import { createServiceRoleClient } from "@repo/supabase/service-role";

// Mock Supabase
jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

// Mock Inngest
jest.mock("@repo/utils/inngest", () => ({
  inngest: {
    createFunction: jest.fn((config, trigger, handler) => {
        // Just return the handler if it's the 3rd arg, or the trigger if it's the 2nd arg
        return handler || trigger;
    }),
  },
}));

// Mock Metrics
jest.mock("@/lib/observability/metrics", () => ({
  recordJobExecution: jest.fn(),
}));

// Mock Error Logger
jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

describe("Orphaned Record Detection Job", () => {
  let mockSupabase: any;
  let insertSpy: jest.Mock;

  beforeEach(() => {
    insertSpy = jest.fn().mockResolvedValue({ error: null });

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: insertSpy,
        then: jest.fn().mockImplementation((callback) => callback({ data: [], error: null })),
      }),
    };

    (createServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it("performs bulk inserts for orphaned records", async () => {
    const orphanedRecords = [
      { id: "1", machine_id: "m1", operator_id: "o1", department_id: "d1" },
      { id: "2", machine_id: "m2", operator_id: "o2", department_id: "d2" },
    ];

    // Mock the first query (invalidMachineOps)
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      not: jest.fn().mockResolvedValue({ data: orphanedRecords, error: null }),
    }));

    // Mock other queries to return empty
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: insertSpy,
      then: jest.fn().mockImplementation((callback) => callback({ data: [], error: null })),
    });

    // Provide mock step and event to avoid destructuring errors if implementation changes
    const mockContext = {
      event: {},
      step: {
        run: jest.fn((id, fn) => fn()),
      },
    };

    // orphanedRecordDetectionFn should be the handler itself because of our mock
    await (orphanedRecordDetectionFn as any)(mockContext);

    // After optimization, it should be called 1 time for all records in the batch
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ record_id: "1", department_id: "d1" }),
      expect.objectContaining({ record_id: "2", department_id: "d2" }),
    ]));
  });
});
