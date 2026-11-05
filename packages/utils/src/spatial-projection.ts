export const HALF_CIRCLE_DEGREES = 180;
export const FULL_CIRCLE_DEGREES = 360;
export const MIN_INCLINATION_DEGREES = -90;
export const MAX_INCLINATION_DEGREES = 90;
export const PRECISION_SCALE = 1_000;

export interface SpatialCoordinate3D {
  readonly eastingMeters: number;
  readonly northingMeters: number;
  readonly elevationMeters: number;
}

export interface BoreholeVectorOptions {
  readonly collar: SpatialCoordinate3D;
  readonly depthMeters: number;
  readonly inclinationDegrees: number;
  readonly azimuthDegrees: number;
}

export interface BoreholeToeResult {
  readonly toe: SpatialCoordinate3D;
  readonly horizontalDisplacementMeters: number;
  readonly trueVerticalDepthMeters: number;
}

export interface ViewportProjectionOptions {
  readonly point: SpatialCoordinate3D;
  readonly minEastingMeters: number;
  readonly maxEastingMeters: number;
  readonly minNorthingMeters: number;
  readonly maxNorthingMeters: number;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly isInvertedNorthAxis?: boolean;
}

export interface ProjectedCanvasPoint {
  readonly canvasXPx: number;
  readonly canvasYPx: number;
  readonly isWithinViewport: boolean;
}

function roundToPrecision(measurement: number): number {
  const roundedMeasurement = Math.round(measurement * PRECISION_SCALE) / PRECISION_SCALE;
  return Object.is(roundedMeasurement, -0) ? 0 : roundedMeasurement;
}

export function computeBoreholeToeCoordinates(options: BoreholeVectorOptions): BoreholeToeResult {
  if (options.depthMeters < 0) {
    throw new Error('Borehole depthMeters must be non-negative');
  }

  if (
    options.inclinationDegrees < MIN_INCLINATION_DEGREES ||
    options.inclinationDegrees > MAX_INCLINATION_DEGREES
  ) {
    throw new Error(
      `Borehole inclinationDegrees must be between ${MIN_INCLINATION_DEGREES} and ${MAX_INCLINATION_DEGREES}`
    );
  }

  const normalizedAzimuthDegrees =
    ((options.azimuthDegrees % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
  const inclinationRadians = (options.inclinationDegrees * Math.PI) / HALF_CIRCLE_DEGREES;
  const azimuthRadians = (normalizedAzimuthDegrees * Math.PI) / HALF_CIRCLE_DEGREES;

  const horizontalDisplacementMeters = options.depthMeters * Math.cos(inclinationRadians);
  const deltaEastingMeters = horizontalDisplacementMeters * Math.sin(azimuthRadians);
  const deltaNorthingMeters = horizontalDisplacementMeters * Math.cos(azimuthRadians);
  const deltaElevationMeters = options.depthMeters * Math.sin(inclinationRadians);
  const trueVerticalDepthMeters = Math.abs(deltaElevationMeters);

  return {
    toe: {
      eastingMeters: roundToPrecision(options.collar.eastingMeters + deltaEastingMeters),
      northingMeters: roundToPrecision(options.collar.northingMeters + deltaNorthingMeters),
      elevationMeters: roundToPrecision(options.collar.elevationMeters + deltaElevationMeters),
    },
    horizontalDisplacementMeters: roundToPrecision(horizontalDisplacementMeters),
    trueVerticalDepthMeters: roundToPrecision(trueVerticalDepthMeters),
  };
}

export function projectWorldToCanvas2D(options: ViewportProjectionOptions): ProjectedCanvasPoint {
  if (options.maxEastingMeters <= options.minEastingMeters) {
    throw new Error('Viewport maxEastingMeters must be greater than minEastingMeters');
  }

  if (options.maxNorthingMeters <= options.minNorthingMeters) {
    throw new Error('Viewport maxNorthingMeters must be greater than minNorthingMeters');
  }

  if (options.canvasWidthPx <= 0 || options.canvasHeightPx <= 0) {
    throw new Error('Canvas dimensions canvasWidthPx and canvasHeightPx must be positive');
  }

  const eastingSpanMeters = options.maxEastingMeters - options.minEastingMeters;
  const northingSpanMeters = options.maxNorthingMeters - options.minNorthingMeters;

  const normalizedEast =
    (options.point.eastingMeters - options.minEastingMeters) / eastingSpanMeters;
  const normalizedNorth =
    (options.point.northingMeters - options.minNorthingMeters) / northingSpanMeters;

  const isWithinViewport =
    normalizedEast >= 0 && normalizedEast <= 1 && normalizedNorth >= 0 && normalizedNorth <= 1;

  const isInvertedNorthAxis = options.isInvertedNorthAxis ?? true;
  const clampedEast = Math.min(1, Math.max(0, normalizedEast));
  const clampedNorth = Math.min(1, Math.max(0, normalizedNorth));
  const verticalRatio = isInvertedNorthAxis ? 1 - clampedNorth : clampedNorth;

  return {
    canvasXPx: roundToPrecision(clampedEast * options.canvasWidthPx),
    canvasYPx: roundToPrecision(verticalRatio * options.canvasHeightPx),
    isWithinViewport,
  };
}
