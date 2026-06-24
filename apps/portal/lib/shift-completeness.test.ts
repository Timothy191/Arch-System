// AGENT-TRACE: Unit tests for shift completeness validation and operational integrity rules in control room
import {
  getShiftCompleteness,
  validateMachineHours,
  validateBinFactor,
  validateLoadConsistency,
  validateShiftDataIntegrity,
} from "./shift-completeness";

// Mock withCache to prevent cross-test cache pollution
jest.mock("@/lib/cache-utils", () => ({
  withCache: jest.fn().mockImplementation((fn) => fn()),
}));

describe("Shift Completeness Validation", () => {
  describe("validateMachineHours", () => {
    it("returns no errors for valid hours (<= 12)", () => {
      const errors = validateMachineHours(8, "day");
      expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("returns error for hours exceeding maximum (> 12)", () => {
      const errors = validateMachineHours(13, "day");
      const errs = errors.filter((e) => e.severity === "error");
      expect(errs).toHaveLength(1);
      expect(errs[0]!.field).toBe("hours_worked");
      expect(errs[0]!.message).toContain("exceeds maximum 12h");
    });

    it("returns warning for high hours (> 8)", () => {
      const errors = validateMachineHours(9, "day");
      const warnings = errors.filter((e) => e.severity === "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.field).toBe("hours_worked");
      expect(warnings[0]!.message).toContain("combined day + night shifts < 16h");
    });
  });

  describe("validateBinFactor", () => {
    it("returns no errors for null/undefined bin_factor", () => {
      expect(validateBinFactor(null)).toHaveLength(0);
    });

    it("returns no errors for valid bin_factor (20-100)", () => {
      expect(validateBinFactor(40.5)).toHaveLength(0);
      expect(validateBinFactor(20)).toHaveLength(0);
      expect(validateBinFactor(100)).toHaveLength(0);
    });

    it("returns error for bin_factor outside range", () => {
      const underErrors = validateBinFactor(19);
      expect(underErrors).toHaveLength(1);
      expect(underErrors[0]!.field).toBe("bin_factor");
      expect(underErrors[0]!.message).toContain("outside reasonable range");

      const overErrors = validateBinFactor(101);
      expect(overErrors).toHaveLength(1);
      expect(overErrors[0]!.field).toBe("bin_factor");
      expect(overErrors[0]!.message).toContain("outside reasonable range");
    });
  });

  describe("validateLoadConsistency", () => {
    it("returns no errors when hoursWorked is missing or 0", () => {
      expect(validateLoadConsistency(10, null)).toHaveLength(0);
      expect(validateLoadConsistency(10, 0)).toHaveLength(0);
    });

    it("returns no errors for reasonable loads per hour (5-50)", () => {
      // 160 loads / 8 hours = 20 loads/hour
      expect(validateLoadConsistency(160, 8)).toHaveLength(0);
    });

    it("returns warning for unusually low loads per hour (< 5)", () => {
      // 24 loads / 8 hours = 3 loads/hour
      const errors = validateLoadConsistency(24, 8);
      const warnings = errors.filter((e) => e.severity === "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.field).toBe("total_loads");
      expect(warnings[0]!.message).toContain("unusually low");
    });

    it("returns error for unusually high loads per hour (> 50)", () => {
      // 480 loads / 8 hours = 60 loads/hour
      const errors = validateLoadConsistency(480, 8);
      const errs = errors.filter((e) => e.severity === "error");
      expect(errs).toHaveLength(1);
      expect(errs[0]!.field).toBe("total_loads");
      expect(errs[0]!.message).toContain("unusually high");
    });
  });

  describe("validateShiftDataIntegrity", () => {
    it("aggregates validations correctly", () => {
      // Valid run
      expect(validateShiftDataIntegrity("machine-1", 8, 160, 40, "day")).toHaveLength(0);

      // Invalid run with multiple failures: hours > 12, bin_factor > 100, loads per hour too high
      const errors = validateShiftDataIntegrity("machine-1", 13, 800, 150, "day");
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getShiftCompleteness", () => {
    const mockSupabaseBuilder = (data: {
      machines: any[];
      machineOps: any[];
      excavatorActs: any[];
      dozerRolls: any[];
      hourlyLoads: any[];
    }) => {
      return {
        from: jest.fn().mockImplementation((table: string) => {
          let responseData: any[] = [];
          if (table === "machines") responseData = data.machines;
          else if (table === "machine_operations") responseData = data.machineOps;
          else if (table === "excavator_activity") responseData = data.excavatorActs;
          else if (table === "dozer_rolls") responseData = data.dozerRolls;
          else if (table === "hourly_loads") responseData = data.hourlyLoads;

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: responseData, error: null }),
            // Handle cases where .order is not called but it resolves
            then: jest
              .fn()
              .mockImplementation((resolve) => resolve({ data: responseData, error: null })),
          };
        }),
      } as any;
    };

    it("identifies shift as complete when all active machines have entries", async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: "m-1",
            name: "DT-101",
            machine_type: "dump truck",
            report_exempt: false,
          },
          {
            id: "m-2",
            name: "DZ-101",
            machine_type: "dozer",
            report_exempt: false,
          },
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [{ machine_id: "m-2", hours_operated: 8 }],
        hourlyLoads: [{ machine_id: "m-1", total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        "dept-1",
        "control-room",
        "2026-06-15",
        "day",
      );
      expect(res.complete).toBe(true);
      expect(res.totalRequired).toBe(2);
      expect(res.totalCovered).toBe(2);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(true);
    });

    it("identifies shift as incomplete when a machine is missing an entry", async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: "m-1",
            name: "DT-101",
            machine_type: "dump truck",
            report_exempt: false,
          },
          {
            id: "m-2",
            name: "DZ-101",
            machine_type: "dozer",
            report_exempt: false,
          },
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [], // Missing
        hourlyLoads: [{ machine_id: "m-1", total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        "dept-1",
        "control-room",
        "2026-06-15",
        "day",
      );
      expect(res.complete).toBe(false);
      expect(res.totalRequired).toBe(2);
      expect(res.totalCovered).toBe(1);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(false);
    });

    it("ignores exempt machines in completeness calculations", async () => {
      const supabase = mockSupabaseBuilder({
        machines: [
          {
            id: "m-1",
            name: "DT-101",
            machine_type: "dump truck",
            report_exempt: false,
          },
          {
            id: "m-2",
            name: "DZ-101",
            machine_type: "dozer",
            report_exempt: true,
          }, // Exempt
        ],
        machineOps: [],
        excavatorActs: [],
        dozerRolls: [], // Missing but exempt
        hourlyLoads: [{ machine_id: "m-1", total_loads: 40 }],
      });

      const res = await getShiftCompleteness(
        supabase,
        "dept-1",
        "control-room",
        "2026-06-15",
        "day",
      );
      expect(res.complete).toBe(true);
      expect(res.totalRequired).toBe(1);
      expect(res.totalCovered).toBe(1);
      expect(res.statuses[0]!.hasEntry).toBe(true);
      expect(res.statuses[1]!.hasEntry).toBe(false);
      expect(res.statuses[1]!.exempt).toBe(true);
    });
  });
});
