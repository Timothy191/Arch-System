import {
  computeBoreholeToeCoordinates,
  projectWorldToCanvas2D,
  type SpatialCoordinate3D,
} from './spatial-projection';

describe('computeBoreholeToeCoordinates', () => {
  const sampleCollar: SpatialCoordinate3D = {
    eastingMeters: 1500,
    northingMeters: 2400,
    elevationMeters: 120,
  };

  it('When borehole inclination is -90 degrees (vertical down), Then toe drops straight down with zero horizontal displacement', () => {
    const verticalResult = computeBoreholeToeCoordinates({
      collar: sampleCollar,
      depthMeters: 18,
      inclinationDegrees: -90,
      azimuthDegrees: 45,
    });

    expect(verticalResult).toEqual({
      toe: {
        eastingMeters: 1500,
        northingMeters: 2400,
        elevationMeters: 102,
      },
      horizontalDisplacementMeters: 0,
      trueVerticalDepthMeters: 18,
    });
  });

  it('When borehole inclination is -60 degrees due East (90 deg azimuth), Then computes angled toe coordinates and displacement', () => {
    const angledResult = computeBoreholeToeCoordinates({
      collar: sampleCollar,
      depthMeters: 20,
      inclinationDegrees: -60,
      azimuthDegrees: 90,
    });

    expect(angledResult).toEqual({
      toe: {
        eastingMeters: 1510,
        northingMeters: 2400,
        elevationMeters: 102.679,
      },
      horizontalDisplacementMeters: 10,
      trueVerticalDepthMeters: 17.321,
    });
  });

  it('When borehole inclination is 0 degrees (horizontal) due North (0 deg azimuth), Then advances northing with zero vertical depth', () => {
    const horizontalResult = computeBoreholeToeCoordinates({
      collar: sampleCollar,
      depthMeters: 15,
      inclinationDegrees: 0,
      azimuthDegrees: 0,
    });

    expect(horizontalResult).toEqual({
      toe: {
        eastingMeters: 1500,
        northingMeters: 2415,
        elevationMeters: 120,
      },
      horizontalDisplacementMeters: 15,
      trueVerticalDepthMeters: 0,
    });
  });

  it('When azimuth is negative (-90 degrees West), Then normalizes azimuth and shifts easting negatively', () => {
    const westHorizontalResult = computeBoreholeToeCoordinates({
      collar: sampleCollar,
      depthMeters: 12,
      inclinationDegrees: 0,
      azimuthDegrees: -90,
    });

    expect(westHorizontalResult.toe.eastingMeters).toBe(1488);
    expect(westHorizontalResult.toe.northingMeters).toBe(2400);
    expect(westHorizontalResult.horizontalDisplacementMeters).toBe(12);
  });

  it('When depthMeters is negative or inclinationDegrees is out of [-90, 90], Then throws descriptive validation Error', () => {
    expect(() =>
      computeBoreholeToeCoordinates({
        collar: sampleCollar,
        depthMeters: -5,
        inclinationDegrees: -90,
        azimuthDegrees: 0,
      })
    ).toThrow('Borehole depthMeters must be non-negative');

    expect(() =>
      computeBoreholeToeCoordinates({
        collar: sampleCollar,
        depthMeters: 10,
        inclinationDegrees: -95,
        azimuthDegrees: 0,
      })
    ).toThrow('Borehole inclinationDegrees must be between -90 and 90');

    expect(() =>
      computeBoreholeToeCoordinates({
        collar: sampleCollar,
        depthMeters: 10,
        inclinationDegrees: 95,
        azimuthDegrees: 0,
      })
    ).toThrow('Borehole inclinationDegrees must be between -90 and 90');
  });
});

describe('projectWorldToCanvas2D', () => {
  it('When projecting an in-bounds point with default inverted North axis, Then maps North to top of canvas (canvasYPx = 0 at maxNorthing)', () => {
    const projectedMidpoint = projectWorldToCanvas2D({
      point: {
        eastingMeters: 1250,
        northingMeters: 2750,
        elevationMeters: 100,
      },
      minEastingMeters: 1000,
      maxEastingMeters: 2000,
      minNorthingMeters: 2000,
      maxNorthingMeters: 3000,
      canvasWidthPx: 800,
      canvasHeightPx: 600,
    });

    expect(projectedMidpoint).toEqual({
      canvasXPx: 200,
      canvasYPx: 150,
      isWithinViewport: true,
    });
  });

  it('When isInvertedNorthAxis is false, Then maps North directly without Y inversion', () => {
    const projectedNonInverted = projectWorldToCanvas2D({
      point: {
        eastingMeters: 1500,
        northingMeters: 2750,
        elevationMeters: 100,
      },
      minEastingMeters: 1000,
      maxEastingMeters: 2000,
      minNorthingMeters: 2000,
      maxNorthingMeters: 3000,
      canvasWidthPx: 800,
      canvasHeightPx: 600,
      isInvertedNorthAxis: false,
    });

    expect(projectedNonInverted).toEqual({
      canvasXPx: 400,
      canvasYPx: 450,
      isWithinViewport: true,
    });
  });

  it('When point lies outside viewport bounds, Then marks isWithinViewport false and clamps canvas coordinates to viewport edges', () => {
    const projectedOutside = projectWorldToCanvas2D({
      point: {
        eastingMeters: 2500,
        northingMeters: 1800,
        elevationMeters: 95,
      },
      minEastingMeters: 1000,
      maxEastingMeters: 2000,
      minNorthingMeters: 2000,
      maxNorthingMeters: 3000,
      canvasWidthPx: 800,
      canvasHeightPx: 600,
    });

    expect(projectedOutside).toEqual({
      canvasXPx: 800,
      canvasYPx: 600,
      isWithinViewport: false,
    });
  });

  it('When viewport bounds or canvas dimensions are invalid, Then throws descriptive validation Error', () => {
    const samplePoint: SpatialCoordinate3D = {
      eastingMeters: 1500,
      northingMeters: 2500,
      elevationMeters: 100,
    };

    expect(() =>
      projectWorldToCanvas2D({
        point: samplePoint,
        minEastingMeters: 2000,
        maxEastingMeters: 1000,
        minNorthingMeters: 2000,
        maxNorthingMeters: 3000,
        canvasWidthPx: 800,
        canvasHeightPx: 600,
      })
    ).toThrow('Viewport maxEastingMeters must be greater than minEastingMeters');

    expect(() =>
      projectWorldToCanvas2D({
        point: samplePoint,
        minEastingMeters: 1000,
        maxEastingMeters: 2000,
        minNorthingMeters: 3000,
        maxNorthingMeters: 3000,
        canvasWidthPx: 800,
        canvasHeightPx: 600,
      })
    ).toThrow('Viewport maxNorthingMeters must be greater than minNorthingMeters');

    expect(() =>
      projectWorldToCanvas2D({
        point: samplePoint,
        minEastingMeters: 1000,
        maxEastingMeters: 2000,
        minNorthingMeters: 2000,
        maxNorthingMeters: 3000,
        canvasWidthPx: 0,
        canvasHeightPx: 600,
      })
    ).toThrow('Canvas dimensions canvasWidthPx and canvasHeightPx must be positive');
  });
});
