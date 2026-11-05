import { z } from 'zod';
import { nonEmptyString } from './common.schema';

const MAX_COORDINATE_METERS = 1_000_000;
const MIN_COORDINATE_METERS = -1_000_000;
const MAX_BOREHOLE_DEPTH_METERS = 5_000;
const MIN_INCLINATION_DEGREES = -90;
const MAX_INCLINATION_DEGREES = 90;
const MAX_AZIMUTH_DEGREES = 360;
const MAX_VIEWPORT_DIMENSION_PX = 16_384;
const MAX_ZOOM_FACTOR = 100;
const MIN_ZOOM_FACTOR = 0.01;
const MAX_IDENTIFIER_LENGTH = 100;

export const spatialPoint3DSchema = z.object({
  eastingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
  northingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
  elevationMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
});
export type SpatialPoint3D = z.infer<typeof spatialPoint3DSchema>;

export const boreholeTrajectorySchema = z.object({
  holeId: nonEmptyString.max(MAX_IDENTIFIER_LENGTH),
  siteId: nonEmptyString.max(MAX_IDENTIFIER_LENGTH),
  collarPoint: spatialPoint3DSchema,
  depthMeters: z.number().positive().max(MAX_BOREHOLE_DEPTH_METERS),
  inclinationDegrees: z.number().min(MIN_INCLINATION_DEGREES).max(MAX_INCLINATION_DEGREES),
  azimuthDegrees: z.number().min(0).max(MAX_AZIMUTH_DEGREES),
});
export type BoreholeTrajectory = z.infer<typeof boreholeTrajectorySchema>;

export const mineBlockVoxelSchema = z.object({
  blockId: nonEmptyString.max(MAX_IDENTIFIER_LENGTH),
  benchElevationMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
  originPoint: spatialPoint3DSchema,
  spanEastMeters: z.number().positive().max(MAX_BOREHOLE_DEPTH_METERS),
  spanNorthMeters: z.number().positive().max(MAX_BOREHOLE_DEPTH_METERS),
  spanVerticalMeters: z.number().positive().max(MAX_BOREHOLE_DEPTH_METERS),
  materialCategory: z.enum(['coal', 'waste', 'overburden', 'reclaim']),
});
export type MineBlockVoxel = z.infer<typeof mineBlockVoxelSchema>;

export const spatialViewportBoundsSchema = z
  .object({
    minEastingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
    maxEastingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
    minNorthingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
    maxNorthingMeters: z.number().min(MIN_COORDINATE_METERS).max(MAX_COORDINATE_METERS),
    viewportWidthPx: z.number().positive().max(MAX_VIEWPORT_DIMENSION_PX),
    viewportHeightPx: z.number().positive().max(MAX_VIEWPORT_DIMENSION_PX),
    zoomFactor: z.number().min(MIN_ZOOM_FACTOR).max(MAX_ZOOM_FACTOR).default(1),
  })
  .refine(
    (bounds) =>
      bounds.maxEastingMeters > bounds.minEastingMeters &&
      bounds.maxNorthingMeters > bounds.minNorthingMeters,
    { message: 'Viewport maximum bounds must exceed minimum bounds' }
  );
export type SpatialViewportBounds = z.infer<typeof spatialViewportBoundsSchema>;
