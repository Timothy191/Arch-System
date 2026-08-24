import {
  dailyLogSchema,
  drillingDailyLogSchema,
  dozerRollSchema,
  multiSiteShiftReportSchema,
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

  it("exports multiSiteShiftReportSchema and validates comprehensive multi-site report payload", () => {
    const sampleMultiSiteReport = {
      meta: {
        department_id: "123e4567-e89b-12d3-a456-426614174000",
        shift_date: "2026-08-24",
        shift_type: "night" as const,
        status: "open" as const,
        closed_at: null,
        closed_by: null,
        notes: "BKF / EXT Operations running normal",
      },
      production: {
        BKF: [
          {
            excavator_id: "123e4567-e89b-12d3-a456-426614174010",
            excavator_name: "EX01 - CAT 349D",
            operator_name: "T. Khumalo",
            material_type: "4#LOWER",
            block_id: "SS07-08",
            operating_hours: 9.5,
            delays: null,
            total_loads: 64,
            total_bcm: 896.0,
            total_tonnes: 2598.4,
            rate_per_hour: 273.5,
            trucks: [
              {
                truck_id: "123e4567-e89b-12d3-a456-426614174020",
                truck_name: "ADT-01",
                loads: 32,
              },
              {
                truck_id: "123e4567-e89b-12d3-a456-426614174021",
                truck_name: "ADT-02",
                loads: 32,
              },
            ],
          },
        ],
      },
      rollover: {
        total_bcm: 2625.0,
        entries: [
          {
            machine_id: "123e4567-e89b-12d3-a456-426614174030",
            machine_name: "DZ-01 CAT D9R",
            operator_name: "J. Sithole",
            start_smu: 1420.5,
            end_smu: 1431.0,
            hours: 10.5,
            push_factor: 250.0,
            total_bcm: 2625.0,
          },
        ],
      },
      fleet_smu: {
        BKF: [
          {
            machine_id: "123e4567-e89b-12d3-a456-426614174010",
            machine_name: "EX01 - CAT 349D",
            machine_type: "Excavator",
            start_smu: 4120.0,
            end_smu: 4129.5,
            hours_worked: 9.5,
            operator_name: "T. Khumalo",
            operational_status: "ACTIVE" as const,
            notes: null,
          },
        ],
      },
      ancillary: [
        {
          machine_name: "WB-01 Water Bowser",
          site_code: "BKF",
          activity_type: "DUST_SUPPRESSION",
          trip_loads: 8,
          fuel_liters: 120.0,
          notes: "Haul road suppression",
        },
      ],
      breakdowns: [
        {
          id: "123e4567-e89b-12d3-a456-426614174040",
          machine_id: "123e4567-e89b-12d3-a456-426614174020",
          machine_name: "ADT-01",
          site_code: "BKF",
          duration_hours: 1.5,
          reason: "Hydraulic hose leak",
          repair_notes: "Replaced O-ring and topped fluid",
          is_operational_defect: false,
          status: "completed" as const,
        },
      ],
      bredell_workshop: [
        {
          machine_name: "DZ-03 CAT D9R",
          reason: "Final drive overhaul",
          date_in: "2026-08-20",
        },
      ],
    };

    const result = multiSiteShiftReportSchema.safeParse(sampleMultiSiteReport);
    expect(result.success).toBe(true);
  });
});
