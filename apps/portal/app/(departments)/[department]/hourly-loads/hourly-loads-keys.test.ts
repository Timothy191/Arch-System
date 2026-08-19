import { buildHourlyLoadsMap, sumHourlyTotal, type HourlyLoad } from "./loads-utils";

/** Regression: day/night rows must not overwrite each other in the grid map. */
describe("hourly loads helpers", () => {
  it("keeps day and night rows for the same machine as separate map entries", () => {
    const map = buildHourlyLoadsMap([
      {
        id: "d1",
        machine_id: "m1",
        shift_type: "day",
        hour_01: 10,
        hour_12: 0,
        total_loads: 10,
      } as HourlyLoad,
      {
        id: "n1",
        machine_id: "m1",
        shift_type: "night",
        hour_01: 20,
        hour_12: 0,
        total_loads: 20,
      } as HourlyLoad,
    ]);

    expect(map.get("m1:day")?.id).toBe("d1");
    expect(map.get("m1:night")?.id).toBe("n1");
    expect(map.size).toBe(2);
  });

  it("sums the twelve hour columns to mirror the DB generated total", () => {
    const load = {
      hour_01: 1,
      hour_02: 2,
      hour_03: 3,
      hour_04: 4,
      hour_05: 5,
      hour_06: 6,
      hour_07: 7,
      hour_08: 8,
      hour_09: 9,
      hour_10: 10,
      hour_11: 11,
      hour_12: 12,
    };
    expect(sumHourlyTotal(load)).toBe(78);
  });

  it("ignores non-hour fields when summing the total", () => {
    const load = {
      hour_01: 5,
      hour_12: 7,
      total_loads: 0,
      machine_id: "m1",
      shift_type: "day",
      id: "x",
    };
    expect(sumHourlyTotal(load)).toBe(12);
  });
});
