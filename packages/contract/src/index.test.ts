import {
  dailyLogSchema,
  drillingDailyLogSchema,
  dozerRollSchema,
  type DailyLogFormValues,
  type DrillingDailyLogFormValues,
  type DozerRollFormValues,
} from "./index";

describe("@repo/contract exports", () => {
  it("exports drillingDailyLogSchema and validates valid input", () => {
    expect(drillingDailyLogSchema).toBeDefined();

    const sampleValidData: DrillingDailyLogFormValues = {
      shift: "day",
      holesDrilled: 12,
      totalDepthMeters: 450,
      penetrationRate: 37.5,
      bitWearPercentage: 15,
      drillPatternId: "PAT-2026-A",
      delayCategory: "none",
      delayMinutes: 0,
      notes: "Normal shift operations",
    };

    const parseResult = drillingDailyLogSchema.safeParse(sampleValidData);
    expect(parseResult.success).toBe(true);
  });

  it("exports dailyLogSchema and dozerRollSchema", () => {
    expect(dailyLogSchema).toBeDefined();
    expect(dozerRollSchema).toBeDefined();

    const sampleDailyLog: DailyLogFormValues = {
      shift: "night",
      notes: "Shift handed off cleanly",
    };
    expect(dailyLogSchema.safeParse(sampleDailyLog).success).toBe(true);

    const sampleDozerRoll: DozerRollFormValues = {
      departmentId: "123e4567-e89b-12d3-a456-426614174000",
      machineId: "123e4567-e89b-12d3-a456-426614174001",
      today: "2026-08-18",
      shiftType: "day",
      bladePasses: 150,
      pushCount: 80,
      hoursOperated: 10.5,
      area: 2500,
    };
    expect(dozerRollSchema.safeParse(sampleDozerRoll).success).toBe(true);
  });
});
