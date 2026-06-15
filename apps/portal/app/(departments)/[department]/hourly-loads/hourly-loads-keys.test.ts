/** Regression: day/night rows must not overwrite each other in the grid map. */
function buildLoadsMap(
  loads: { machine_id: string; shift_type: string; total_loads: number }[],
) {
  const map = new Map<string, number>();
  for (const load of loads) {
    map.set(`${load.machine_id}:${load.shift_type}`, load.total_loads);
  }
  return map;
}

describe("hourly loads shift map keys", () => {
  it("keeps day and night totals for the same machine", () => {
    const map = buildLoadsMap([
      { machine_id: "m1", shift_type: "day", total_loads: 10 },
      { machine_id: "m1", shift_type: "night", total_loads: 20 },
    ]);

    expect(map.get("m1:day")).toBe(10);
    expect(map.get("m1:night")).toBe(20);
  });
});
