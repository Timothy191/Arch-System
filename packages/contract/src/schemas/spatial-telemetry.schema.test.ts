import {
  boreholeTrajectorySchema,
  mineBlockVoxelSchema,
  spatialPoint3DSchema,
  spatialViewportBoundsSchema,
} from './spatial-telemetry.schema';

describe('spatialPoint3DSchema', () => {
  it('validates a 3D coordinate within mine bounds', () => {
    const coordinatePayload = {
      eastingMeters: 284500.5,
      northingMeters: 712340.25,
      elevationMeters: 1540.8,
    };

    const parseOutcome = spatialPoint3DSchema.safeParse(coordinatePayload);
    expect(parseOutcome.success).toBe(true);
  });

  it('rejects coordinates exceeding maximum meter limits', () => {
    const outOfRangeCoordinate = {
      eastingMeters: 1_500_000,
      northingMeters: 500,
      elevationMeters: 1500,
    };

    const parseOutcome = spatialPoint3DSchema.safeParse(outOfRangeCoordinate);
    expect(parseOutcome.success).toBe(false);
  });
});

describe('boreholeTrajectorySchema', () => {
  it('validates a valid borehole collar and trajectory configuration', () => {
    const trajectoryPayload = {
      holeId: 'BH-2026-042',
      siteId: 'SITE-KRIEL-NORTH',
      collarPoint: {
        eastingMeters: 12400.0,
        northingMeters: 34800.0,
        elevationMeters: 1580.5,
      },
      depthMeters: 42.5,
      inclinationDegrees: -75,
      azimuthDegrees: 180,
    };

    const parseOutcome = boreholeTrajectorySchema.safeParse(trajectoryPayload);
    expect(parseOutcome.success).toBe(true);
  });

  it('rejects non-positive depth or out-of-bounds inclination and azimuth', () => {
    const invalidDepthPayload = {
      holeId: 'BH-2026-043',
      siteId: 'SITE-KRIEL-NORTH',
      collarPoint: {
        eastingMeters: 12400.0,
        northingMeters: 34800.0,
        elevationMeters: 1580.5,
      },
      depthMeters: 0,
      inclinationDegrees: -95,
      azimuthDegrees: 400,
    };

    const parseOutcome = boreholeTrajectorySchema.safeParse(invalidDepthPayload);
    expect(parseOutcome.success).toBe(false);
  });
});

describe('mineBlockVoxelSchema', () => {
  it('validates a 3D mine block voxel with valid dimensions and material category', () => {
    const voxelPayload = {
      blockId: 'BLK-BENCH-1540-A1',
      benchElevationMeters: 1540,
      originPoint: {
        eastingMeters: 10200,
        northingMeters: 20400,
        elevationMeters: 1540,
      },
      spanEastMeters: 50,
      spanNorthMeters: 100,
      spanVerticalMeters: 12,
      materialCategory: 'coal',
    };

    const parseOutcome = mineBlockVoxelSchema.safeParse(voxelPayload);
    expect(parseOutcome.success).toBe(true);
  });

  it('rejects unsupported material categories or non-positive voxel spans', () => {
    const invalidVoxelPayload = {
      blockId: 'BLK-BENCH-1540-A2',
      benchElevationMeters: 1540,
      originPoint: {
        eastingMeters: 10200,
        northingMeters: 20400,
        elevationMeters: 1540,
      },
      spanEastMeters: -10,
      spanNorthMeters: 100,
      spanVerticalMeters: 12,
      materialCategory: 'limestone',
    };

    const parseOutcome = mineBlockVoxelSchema.safeParse(invalidVoxelPayload);
    expect(parseOutcome.success).toBe(false);
  });
});

describe('spatialViewportBoundsSchema', () => {
  it('validates viewport bounds and applies default zoomFactor of 1', () => {
    const viewportPayload = {
      minEastingMeters: 10000,
      maxEastingMeters: 12000,
      minNorthingMeters: 20000,
      maxNorthingMeters: 22000,
      viewportWidthPx: 1920,
      viewportHeightPx: 1080,
    };

    const parsedBounds = spatialViewportBoundsSchema.parse(viewportPayload);
    expect(parsedBounds.zoomFactor).toBe(1);
  });

  it('rejects inverted viewport bounds where maximum does not exceed minimum', () => {
    const invertedViewportPayload = {
      minEastingMeters: 12000,
      maxEastingMeters: 10000,
      minNorthingMeters: 20000,
      maxNorthingMeters: 22000,
      viewportWidthPx: 1920,
      viewportHeightPx: 1080,
      zoomFactor: 2,
    };

    const parseOutcome = spatialViewportBoundsSchema.safeParse(invertedViewportPayload);
    expect(parseOutcome.success).toBe(false);
  });
});
