import { setPin, verifyPin, closeShift } from "./shift-closeout";
import { getRedisClient } from "@repo/redis";

jest.mock("./shift-completeness", () => {
  const actual = jest.requireActual("./shift-completeness");
  return {
    ...actual,
    getShiftCompleteness: jest.fn(),
  };
});

import { getShiftCompleteness } from "./shift-completeness";
const mockGetShiftCompleteness = getShiftCompleteness as jest.Mock;

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue("salt"),
  hash: jest.fn().mockResolvedValue("hashed-pin"),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("./audit", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");
const bcrypt = jest.requireMock("bcryptjs");

const mockDbQuery: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((onfulfilled) => {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled);
  }),
};

beforeEach(async () => {
  const redis = await getRedisClient();
  // AGENT-TRACE: Correct flushDb casing for modern Redis client
  await redis.flushDb();
});

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const base = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "auth-user-1" } },
      }),
    },
    from: jest.fn(),
    ...overrides,
  };
  createServerSupabaseClient.mockResolvedValue(base);
  return base;
}

describe("verifyPin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns valid=false when employee is not found", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const result = await verifyPin("EMP-001", "1234");
    expect(result.valid).toBe(false);
    expect(result.employee).toBeNull();
  });

  it("returns valid=false when employee has no pin_hash", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "emp-1", full_name: "John", pin_hash: null },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await verifyPin("EMP-001", "1234");
    expect(result.valid).toBe(false);
    expect(result.employee).toBeNull();
  });

  it("returns valid=true with employee when PIN matches", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "emp-1",
                full_name: "John Smith",
                pin_hash: "$2b$10$hashedpin",
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    bcrypt.compare.mockResolvedValue(true);

    const result = await verifyPin("EMP-001", "1234");
    expect(result.valid).toBe(true);
    expect(result.employee).toEqual({ id: "emp-1", full_name: "John Smith" });
  });

  it("returns valid=false when PIN does not match", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "emp-1",
                full_name: "John Smith",
                pin_hash: "$2b$10$hashedpin",
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    bcrypt.compare.mockResolvedValue(false);

    const result = await verifyPin("EMP-001", "9999");
    expect(result.valid).toBe(false);
    expect(result.employee).toBeNull();
  });
});

describe("closeShift (validateOnly=true)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetShiftCompleteness.mockResolvedValue({
      complete: true,
      totalRequired: 1,
      totalCovered: 1,
      statuses: [
        {
          machineId: "m-1",
          machineName: "Drill Rig 1",
          machineType: "Drill",
          requiredForm: "machine-operations",
          formLabel: "Machine Operations",
          formPath: "/machine-operations",
          hasEntry: true,
          exempt: false,
          hoursWorked: 8,
        },
      ],
    });
  });

  it("returns errors when shift is already closed", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: "ss-1", status: "closed" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
        };
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234", true);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Shift is already closed");
  });

  it("returns errors when no active machines exist", async () => {
    mockGetShiftCompleteness.mockResolvedValue({
      complete: true,
      totalRequired: 0,
      totalCovered: 0,
      statuses: [],
    });

    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234", true);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("No active machines found for this department");
  });

  it("returns errors for unreported machines", async () => {
    mockGetShiftCompleteness.mockResolvedValue({
      complete: false,
      totalRequired: 1,
      totalCovered: 0,
      statuses: [
        {
          machineId: "m-1",
          machineName: "Excavator A",
          machineType: "Excavator",
          requiredForm: "excavator-activity",
          formLabel: "Excavator Activity",
          formPath: "/excavator-activity",
          hasEntry: false,
          exempt: false,
        },
      ],
    });

    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234", true);

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("Excavator A"))).toBe(true);
    expect(result.errors?.some((e) => e.includes("not reported"))).toBe(true);
  });

  it("returns errors when machine hours exceed 12h", async () => {
    mockGetShiftCompleteness.mockResolvedValue({
      complete: true,
      totalRequired: 1,
      totalCovered: 1,
      statuses: [
        {
          machineId: "m-1",
          machineName: "Drill Rig 1",
          machineType: "Drill",
          requiredForm: "machine-operations",
          formLabel: "Machine Operations",
          formPath: "/machine-operations",
          hasEntry: true,
          exempt: false,
          hoursWorked: 15,
        },
      ],
    });

    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234", true);

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("15h exceeds") && e.includes("12h"))).toBe(true);
  });

  it("returns success when all machines are reported within limits", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234", true);

    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setPin
// ---------------------------------------------------------------------------

describe("setPin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: jest.fn(),
    });

    await expect(setPin("EMP-001", "1234")).rejects.toThrow();
  });

  it("throws NotFoundError when employee record is missing", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
          }),
        }),
      }),
    });

    await expect(setPin("EMP-001", "1234")).rejects.toThrow();
  });

  it("throws ForbiddenError when employee role is not supervisor or admin", async () => {
    buildSupabaseMock({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "emp-1", role: "operator" },
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(setPin("EMP-001", "1234")).rejects.toThrow();
  });

  it("throws DatabaseError when update fails", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "emp-1", role: "supervisor" },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: "DB error" } }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    await expect(setPin("EMP-001", "1234")).rejects.toThrow();
  });

  it("returns success when PIN is set successfully", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "employees") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "emp-1", role: "supervisor" },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await setPin("EMP-001", "1234");
    expect(result.success).toBe(true);
  });
});

describe("closeShift (validateOnly=false)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetShiftCompleteness.mockResolvedValue({
      complete: true,
      totalRequired: 1,
      totalCovered: 1,
      statuses: [
        {
          machineId: "m-1",
          machineName: "Drill Rig 1",
          machineType: "Drill",
          requiredForm: "machine-operations",
          formLabel: "Machine Operations",
          formPath: "/machine-operations",
          hasEntry: true,
          exempt: false,
          hoursWorked: 8,
        },
      ],
    });
  });

  it("returns error when authenticated user has no employee record", async () => {
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        // employees — closedBy not found
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    });

    await expect(closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234")).rejects.toThrow();
  });

  it("returns error when approver has no PIN set", async () => {
    let employeeCallCount = 0;
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "employees") {
          employeeCallCount++;
          if (employeeCallCount === 1) {
            // closedBy
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: "emp-1" }, error: null }),
                }),
              }),
            };
          }
          // approver — no pin_hash
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: "approver-1",
                    pin_hash: null,
                    full_name: "Approver",
                  },
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Approving supervisor not found or has no PIN set");
  });

  it("returns error when supervisor PIN is wrong", async () => {
    let employeeCallCount = 0;
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "employees") {
          employeeCallCount++;
          if (employeeCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: "emp-1" }, error: null }),
                }),
              }),
            };
          }
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: "approver-1",
                    pin_hash: "$2b$hash",
                    full_name: "Approver",
                  },
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    bcrypt.compare.mockResolvedValue(false);

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "wrong");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Invalid supervisor PIN");
  });

  it("returns error when shift_status insert fails", async () => {
    let employeeCallCount = 0;
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "insert failed" },
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "employees") {
          employeeCallCount++;
          if (employeeCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: "emp-1" }, error: null }),
                }),
              }),
            };
          }
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: "approver-1",
                    pin_hash: "$2b$hash",
                    full_name: "Approver",
                  },
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    bcrypt.compare.mockResolvedValue(true);

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Failed to close shift");
  });

  it("throws AuthError when user is not authenticated", async () => {
    buildSupabaseMock({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    await expect(closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234")).rejects.toThrow();
  });

  it("returns success when PIN is valid and shift is closed", async () => {
    const { logAuditEvent } = jest.requireMock("./audit");
    let employeeCallCount = 0;
    buildSupabaseMock({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "shift_status") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "status-99" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "machines") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ id: "m-1", name: "Drill Rig 1" }],
                }),
              }),
            }),
          };
        }
        if (table === "machine_operations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ machine_id: "m-1", hours_worked: 8 }],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "employees") {
          employeeCallCount++;
          if (employeeCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: "emp-1" }, error: null }),
                }),
              }),
            };
          }
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: "approver-1",
                    pin_hash: "$2b$hash",
                    full_name: "Approver",
                  },
                }),
              }),
            }),
          };
        }
        return mockDbQuery;
      }),
    });

    bcrypt.compare.mockResolvedValue(true);

    const result = await closeShift("dept-1", "2026-05-17", "day", "approver-1", "1234");
    expect(result.success).toBe(true);
    expect(result.shiftStatusId).toBe("status-99");
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "shift_status",
        recordId: "status-99",
      }),
    );
  });
});
