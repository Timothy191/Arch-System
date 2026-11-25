import '@testing-library/jest-dom';
import {
  buildEarthSurfaceDots,
  formatCoordinates,
  GLOBE_FRAGMENT_SHADER_SOURCE,
  GlobePins,
  isLandCoordinate,
  latLonToUnitVec3,
  rotateVec3,
  sampleGeodesicArc,
  targetOrbitForLatLon,
} from '@repo/ui/components/GlobePins';
import { fireEvent, render, screen } from '@testing-library/react';

function createMockCanvasContext() {
  const mockGradient = { addColorStop: jest.fn() };
  return {
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    setTransform: jest.fn(),
    translate: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    roundRect: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    clip: jest.fn(),
    setLineDash: jest.fn(),
    measureText: jest.fn(() => ({ width: 48 })),
    fillText: jest.fn(),
    createRadialGradient: jest.fn(() => mockGradient),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };
}

describe('globe-math 3D geometry', () => {
  it('converts lat/lon coordinates to unit vectors and centers target coordinates via orbit rotation', () => {
    const capeVec = latLonToUnitVec3(-33.9, 18.4);
    expect(Math.hypot(capeVec.x, capeVec.y, capeVec.z)).toBeCloseTo(1, 6);

    const targetOrbit = targetOrbitForLatLon(-33.9, 18.4);
    const rotated = rotateVec3(capeVec, targetOrbit);
    expect(rotated.x).toBeCloseTo(0, 5);
    expect(rotated.y).toBeCloseTo(0, 5);
    expect(rotated.z).toBeCloseTo(1, 5);
  });

  it('distinguishes real landmass coordinates from open ocean and builds Earth dot-matrix', () => {
    expect(isLandCoordinate(-33.9, 18.4)).toBe(true); // Cape Town
    expect(isLandCoordinate(-22.9, 14.2)).toBe(true); // Namibia / Pit Viper 351
    expect(isLandCoordinate(-31.9, 115.8)).toBe(true); // Perth
    expect(isLandCoordinate(-37.8, 175.2)).toBe(true); // New Zealand North Island
    expect(isLandCoordinate(40.7, -74.0)).toBe(true); // US East
    expect(isLandCoordinate(0, -150)).toBe(false); // Mid-Pacific Ocean
    expect(isLandCoordinate(15, -40)).toBe(false); // Mid-Atlantic Ocean

    const dots = buildEarthSurfaceDots();
    expect(dots.length).toBeGreaterThan(300);
  });

  it('elevates 3D geodesic arc midpoints above unit sphere and formats coordinates', () => {
    const startVec = latLonToUnitVec3(-33.9, 18.4);
    const endVec = latLonToUnitVec3(40.7, -74.0);
    const arc = sampleGeodesicArc({
      startVec,
      endVec,
      segmentCount: 20,
      peakAltitude: 0.16,
    });
    expect(arc).toHaveLength(21);
    const midpoint = arc[10];
    expect(midpoint).toBeDefined();
    if (midpoint) {
      expect(Math.hypot(midpoint.x, midpoint.y, midpoint.z)).toBeCloseTo(1.16, 4);
    }

    expect(formatCoordinates(-33.9, 18.4)).toBe('33.9°S, 18.4°E');
    expect(formatCoordinates(40.7, -74.0)).toBe('40.7°N, 74.0°W');
  });
});

describe('GlobePins interactive 3D Canvas component', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => createMockCanvasContext() as unknown as CanvasRenderingContext2D
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    window.requestAnimationFrame = jest.fn(() => 1);
    window.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  });

  it('renders 3D globe canvas, header metadata, and interactive site controls', () => {
    const mockCtx = createMockCanvasContext();
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => mockCtx as unknown as CanvasRenderingContext2D
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(<GlobePins />);

    expect(screen.getByText('Active Site Pins')).toBeInTheDocument();
    expect(screen.getByText('5 operational sites')).toBeInTheDocument();
    expect(screen.getByText('All sites online')).toBeInTheDocument();

    const globeCanvas = screen.getByTestId('operations-3d-globe');
    expect(globeCanvas).toHaveAttribute('role', 'img');
    expect(globeCanvas).toHaveAttribute('aria-label', 'Operations globe');
    expect(mockCtx.createRadialGradient).toHaveBeenCalled();

    const dbCoreButton = screen.getByRole('button', { name: /DB Core/i });
    expect(dbCoreButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dbCoreButton);
    expect(dbCoreButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Resume globe rotation' })).toBeInTheDocument();

    fireEvent.pointerDown(globeCanvas, { clientX: 120, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(globeCanvas, { clientX: 155, clientY: 132, pointerId: 1 });
    fireEvent.pointerUp(globeCanvas, { clientX: 155, clientY: 132, pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Reset 3D globe view' }));
    expect(screen.getByRole('button', { name: 'Pause globe rotation' })).toBeInTheDocument();

    expect(screen.getByTestId('globe-dept-metrics-overview')).toBeInTheDocument();
    const layerToggle = screen.getByRole('button', {
      name: /Switch to NASA Live VIIRS satellite imagery/i,
    });
    fireEvent.click(layerToggle);
    expect(
      screen.getByRole('button', { name: /Switch to NASA Blue Marble layer/i })
    ).toBeInTheDocument();
  });

  it('includes dual-texture VIIRS black-swath fallback and studio fill lighting in the WebGL fragment shader', () => {
    expect(GLOBE_FRAGMENT_SHADER_SOURCE).toContain('uniform sampler2D u_overlayTexture;');
    expect(GLOBE_FRAGMENT_SHADER_SOURCE).toContain('overlayMask');
    expect(GLOBE_FRAGMENT_SHADER_SOURCE).toContain('fillDir');
  });

  it('synchronizes the telemetry metrics graph panel with the active HeroRotator department', () => {
    render(
      <GlobePins
        activePanel={{
          id: 'drilling',
          name: 'drilling',
          title: 'Drilling Operations',
          description: 'Drill rig bit depth telemetry',
          category: 'Field Operations',
          image: '/images/departments/drilling.webp',
          stats: { label: 'Depth', value: '1,240m' },
          trend: [42, 48, 55, 62, 70],
          status: 'active',
          icon: <span aria-hidden="true" />,
          iconBgColor: 'bg-accent-gold/10',
          primary: { href: '/drilling', label: 'Drilling', icon: <span aria-hidden="true" /> },
          assetOverline: 'FIELD OPERATIONS // UNIT-PV351',
        }}
      />
    );

    expect(screen.getByTestId('globe-dept-metrics-drilling')).toBeInTheDocument();
    expect(screen.getByText('Drilling Operations Telemetry')).toBeInTheDocument();
    expect(screen.getByText('FIELD OPERATIONS // UNIT-PV351')).toBeInTheDocument();
    expect(screen.getByText('DELTA +66.7%')).toBeInTheDocument();
  });
});
