import { bench, describe } from "vitest";
import {
  drillTelemetryIngestSchema,
  telemetryPushSchema,
  unifiedShiftReportSchema,
} from "../contract/src";

// ---------------------------------------------------------------------------
// Realistic payloads
// ---------------------------------------------------------------------------

const UUID = "3f1c8e42-9b1a-4c7d-8e2f-1a2b3c4d5e6f";

const telemetrySample = {
  name: "engine_rpm",
  value: 1450.5,
  timestamp: "2026-09-17T10:15:00.000Z",
  machine_id: UUID,
  department_id: UUID,
  tags: { site: "plantcor", rig: "R-04" },
};

// Mimics the /api/plugins/rust-telemetry ingest loop: a push body with many
// telemetry points validated in sequence per request.
const telemetryBatch = Array.from({ length: 100 }, (_, i) => ({
  ...telemetrySample,
  name: `sensor_${i % 20}`,
  value: 1000 + i,
}));

const drillSample = {
  machine_id: UUID,
  engine_rpm: 1800,
  engine_temp: 92,
  hydraulic_pressure: 32000,
  vibration_level: 12,
  fuel_level: 68,
  bit_depth: 42.5,
  penetration_rate: 18,
  pull_down_force: 210000,
  rotary_speed: 120,
  timestamp: "2026-09-17T10:15:00.000Z",
};

const shiftReportSample = {
  meta: {
    department_id: UUID,
    shift_date: "2026-09-17",
    shift_type: "day" as const,
    compiled_at: "2026-09-17T19:00:00.000Z",
  },
  shift_status: { status: "open" as const },
  production: {
    total_loads: 480,
    machines: Array.from({ length: 12 }, (_, i) => ({
      machine_id: UUID,
      machine_name: `CAT 785-${i}`,
      machine_type: "haul_truck",
      total_loads: 40,
      hourly_distribution: Object.fromEntries(
        Array.from({ length: 12 }, (_, h) => [`h${h}`, 3 + (h % 4)])
      ),
    })),
  },
  fleet_performance: Array.from({ length: 12 }, (_, i) => ({
    machine_id: UUID,
    machine_name: `CAT 785-${i}`,
    machine_type: "haul_truck",
    hours_worked: 11.5,
    breakdown_hours: 0.5,
    delay_hours: 0.2,
    mechanical_availability_pct: 95.6,
  })),
  breakdowns: Array.from({ length: 30 }, (_, i) => ({
    id: UUID,
    machine_id: UUID,
    machine_name: `CAT 785-${i % 12}`,
    time_in: "2026-09-17T08:00:00.000Z",
    time_out: "2026-09-17T10:00:00.000Z",
    reason: "hydraulic leak",
    status: "completed" as const,
  })),
  tire_management: Array.from({ length: 40 }, (_, i) => ({
    id: UUID,
    tire_id: UUID,
    serial_number: `TIRE-${1000 + i}`,
    machine_name: `CAT 785-${i % 12}`,
    position: "FL",
    pressure_psi: 120,
    tread_depth_mm: 38.5,
    condition_status: "good" as const,
  })),
};

// ---------------------------------------------------------------------------
// Benchmarks — every Server Action / API route boundary runs safeParse, so
// schema throughput is on the hot path of the whole portal.
// ---------------------------------------------------------------------------

describe("contract/telemetry", () => {
  bench("telemetryPushSchema x100 (batch ingest)", () => {
    for (const point of telemetryBatch) {
      const r = telemetryPushSchema.safeParse(point);
      if (!r.success) throw new Error("unexpected parse failure");
    }
  });

  bench("telemetryPushSchema x1 (single point)", () => {
    const r = telemetryPushSchema.safeParse(telemetrySample);
    if (!r.success) throw new Error("unexpected parse failure");
  });
});

describe("contract/drill", () => {
  bench("drillTelemetryIngestSchema (full payload)", () => {
    const r = drillTelemetryIngestSchema.safeParse(drillSample);
    if (!r.success) throw new Error("unexpected parse failure");
  });
});

describe("contract/shift-compilation", () => {
  bench("unifiedShiftReportSchema (12 machines / 30 breakdowns / 40 tires)", () => {
    const r = unifiedShiftReportSchema.safeParse(shiftReportSample);
    if (!r.success) throw new Error("unexpected parse failure");
  });
});
