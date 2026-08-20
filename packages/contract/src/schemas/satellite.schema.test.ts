import { describe, it, expect } from "@jest/globals";
import { insarGeoTIFFUploadSchema, insarTelemetryIngestSchema } from "./satellite.schema.js";

describe("insarGeoTIFFUploadSchema", () => {
  it("validates correct InSAR GeoTIFF metadata payload", () => {
    const payload = {
      department_id: "123e4567-e89b-12d3-a456-426614174000",
      satellite_name: "Sentinel-1",
      pass_direction: "ascending",
      acquisition_date: "2026-08-20",
      reference_date: "2026-08-01",
      location_name: "North Pit Wall - Sector 4",
      min_lat: -25.74,
      max_lat: -25.70,
      min_lon: 28.22,
      max_lon: 28.26,
      max_displacement_mm: -18.5,
      coherence_threshold: 0.65,
    };

    const result = insarGeoTIFFUploadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("fails when satellite_name is invalid", () => {
    const payload = {
      department_id: "123e4567-e89b-12d3-a456-426614174000",
      satellite_name: "Hubble",
      pass_direction: "ascending",
      acquisition_date: "2026-08-20",
      reference_date: "2026-08-01",
      location_name: "North Pit Wall",
      min_lat: -25.74,
      max_lat: -25.70,
      min_lon: 28.22,
      max_lon: 28.26,
      max_displacement_mm: -5.0,
    };

    const result = insarGeoTIFFUploadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("insarTelemetryIngestSchema", () => {
  it("validates correct InSAR spatial deformation telemetry point", () => {
    const payload = {
      department_id: "123e4567-e89b-12d3-a456-426614174000",
      satellite_name: "TerraSAR-X",
      acquisition_date: "2026-08-20",
      reference_date: "2026-08-01",
      location_name: "South Highwall Ramp B",
      latitude: -25.742,
      longitude: 28.225,
      displacement_mm: 22.4,
      coherence_index: 0.88,
    };

    const result = insarTelemetryIngestSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
