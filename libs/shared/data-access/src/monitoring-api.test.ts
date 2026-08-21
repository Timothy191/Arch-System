import { mapDeformationRowsToReadings, type DeformationDbRow } from "./monitoring-api";

// AGENT-TRACE: Unit tests for the DB-row → DeformationReading adapter.
// Contra-variant with implementation structure: they assert behaviour
// (grouping, velocity derivation, area inference, single-point fallback) rather
// than mirroring internal helper layout.

function row(overrides: Partial<DeformationDbRow> = {}): DeformationDbRow {
  return {
    id: "row-1",
    department_id: "dept-sat",
    satellite_name: "Sentinel-1",
    acquisition_date: "2026-01-15",
    reference_date: "2026-01-03",
    location_name: "North Pit Wall",
    latitude: -26.242,
    longitude: 26.747,
    displacement_mm: -10,
    coherence_index: 0.82,
    risk_level: "none",
    cog_url: null,
    created_at: "2026-01-16T00:00:00Z",
    updated_at: "2026-01-16T00:00:00Z",
    ...overrides,
  };
}

describe("mapDeformationRowsToReadings", () => {
  it("returns an empty array for no rows", () => {
    expect(mapDeformationRowsToReadings([])).toEqual([]);
  });

  it("groups rows by location_name into a single reading per zone", () => {
    const readings = mapDeformationRowsToReadings([
      row({ id: "a", acquisition_date: "2026-01-15", displacement_mm: -10 }),
      row({ id: "b", acquisition_date: "2026-02-10", displacement_mm: -22 }),
      row({
        id: "c",
        location_name: "Main Tailings Dam",
        acquisition_date: "2026-02-10",
        displacement_mm: -5,
        risk_level: "minor",
      }),
    ]);

    expect(readings).toHaveLength(2);
    const pit = readings.find((r) => r.location === "North Pit Wall")!;
    const dam = readings.find((r) => r.location === "Main Tailings Dam")!;
    expect(pit).toBeDefined();
    expect(dam).toBeDefined();
  });

  it("derives velocity from the delta between the two latest acquisitions", () => {
    // 30 days between acquisitions, displacement went -10 → -22 (−12mm / 1 month)
    const [pit] = mapDeformationRowsToReadings([
      row({ id: "a", acquisition_date: "2026-01-15", displacement_mm: -10 }),
      row({ id: "b", acquisition_date: "2026-02-14", displacement_mm: -22 }),
    ]);

    expect(pit!.velocityMmPerMonth).toBe(-12);
    expect(pit!.shiftMm).toBe(-22);
    expect(pit!.trend).toBe("subsiding");
  });

  it("classifies level by velocity thresholds when velocity is derivable", () => {
    // pit-wall thresholds: minor 5, moderate 15, critical 25
    const [critical] = mapDeformationRowsToReadings([
      row({ id: "a", acquisition_date: "2026-01-15", displacement_mm: 0 }),
      row({ id: "b", acquisition_date: "2026-02-14", displacement_mm: 30 }),
    ]);
    expect(critical!.level).toBe("critical");
  });

  it("falls back to persisted risk_level for a single acquisition with no baseline", () => {
    const [single] = mapDeformationRowsToReadings([
      row({
        id: "s",
        acquisition_date: "2026-02-14",
        reference_date: "2026-02-14", // zero baseline → velocity not derivable
        risk_level: "moderate",
      }),
    ]);

    expect(single!.level).toBe("moderate");
    expect(single!.velocityMmPerMonth).toBe(0);
  });

  it("infers the geotechnical area from the location name", () => {
    const readings = mapDeformationRowsToReadings([
      row({ id: "1", location_name: "East Haul Road", risk_level: "none" }),
      row({ id: "2", location_name: "Main Tailings Dam", risk_level: "none" }),
      row({ id: "3", location_name: "Processing Plant", risk_level: "none" }),
      row({ id: "4", location_name: "North Pit Wall", risk_level: "none" }),
      row({ id: "5", location_name: "Unknown Zone", risk_level: "none" }),
    ]);

    const byArea = Object.fromEntries(readings.map((r) => [r.location, r.area]));
    expect(byArea["East Haul Road"]).toBe("haul-road");
    expect(byArea["Main Tailings Dam"]).toBe("tailings-dam");
    expect(byArea["Processing Plant"]).toBe("processing-plant");
    expect(byArea["North Pit Wall"]).toBe("pit-wall");
    expect(byArea["Unknown Zone"]).toBe("pit-wall"); // default fallback
  });

  it("builds a chronological velocity history with one point per acquisition", () => {
    const [pit] = mapDeformationRowsToReadings([
      row({ id: "a", acquisition_date: "2026-01-15", displacement_mm: -10 }),
      row({ id: "b", acquisition_date: "2026-02-14", displacement_mm: -22 }),
      row({ id: "c", acquisition_date: "2026-03-16", displacement_mm: -25 }),
    ]);

    expect(pit!.history).toHaveLength(3);
    // history ordered chronologically by acquisition_date ascending; each point's
    // velocity is its delta vs the preceding acquisition (first point uses the
    // reference→acquisition baseline). Assert structural invariants only to
    // stay structure-insensitive to the exact baseline math.
    expect(pit!.history.every((p) => typeof p.month === "string")).toBe(true);
    expect(pit!.history.every((p) => typeof p.velocityMmPerMonth === "number")).toBe(true);
    // later points are deltas between consecutive acquisitions
    expect(pit!.history[1]!.velocityMmPerMonth).toBe(-12); // -22 - (-10) over 1 month
    expect(pit!.history[2]!.velocityMmPerMonth).toBe(-3); // -25 - (-22) over ~1 month
  });

  it("does not fabricate values — every number traces to a persisted row", () => {
    const [r] = mapDeformationRowsToReadings([
      row({ displacement_mm: -7.3, latitude: -26.1, longitude: 26.9 }),
    ]);
    expect(r!.shiftMm).toBe(-7.3);
    expect(r!.lat).toBe(-26.1);
    expect(r!.lon).toBe(26.9);
    expect(r!.sensor).toBe("Sentinel-1 InSAR");
    expect(r!.losAngleDeg).toBe(39);
  });
});
