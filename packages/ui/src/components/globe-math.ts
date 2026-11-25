export interface GlobePin {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
  readonly color?: string;
  readonly region?: string;
  readonly status?: 'online' | 'standby' | 'alert';
  readonly siteCode?: string;
  readonly telemetrySummary?: string;
}

export interface OperationalSiteInput {
  readonly id: string;
  readonly name: string;
  readonly siteCode: string;
  readonly active: boolean;
  readonly activeBreakdowns?: number;
  readonly todayLoads?: number;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface OrbitAngles {
  readonly yawRad: number;
  readonly pitchRad: number;
}

export interface GlobeViewport {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusPx: number;
  readonly cameraDistanceMult?: number;
}

export interface ProjectedPoint3D {
  readonly screenX: number;
  readonly screenY: number;
  readonly scale: number;
  readonly depthZ: number;
  readonly isFront: boolean;
}

export interface SurfaceDot {
  readonly unitVec: Vec3;
}

export const DEG_TO_RAD = Math.PI / 180;
export const FULL_CIRCLE_RAD = Math.PI * 2;
export const CAMERA_DISTANCE_MULT = 3.2;
export const LIMB_SCALE_NORM =
  CAMERA_DISTANCE_MULT / Math.sqrt(CAMERA_DISTANCE_MULT * CAMERA_DISTANCE_MULT - 1);
export const MIN_PITCH_RAD = -1.15;
export const MAX_PITCH_RAD = 1.15;
export const INITIAL_ORBIT_YAW_RAD = 28.68 * DEG_TO_RAD;
export const INITIAL_ORBIT_PITCH_RAD = -26.15 * DEG_TO_RAD;
export const FIBONACCI_DOT_COUNT = 2400;

export const GLOBE_SPHERE_FILL_RATIO = 0.36;

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
const POLE_THRESHOLD_LAT = 88;
const MPUMALANGA_BASE_LAT = -26.15;
const MPUMALANGA_BASE_LON = 28.68;

interface MpumalangaCoordinatePreset {
  readonly lat: number;
  readonly lon: number;
  readonly region: string;
  readonly color: string;
}

const MPUMALANGA_SITE_COORDINATES: Readonly<Record<string, MpumalangaCoordinatePreset>> = {
  'BRAK-PIT': {
    lat: -26.15,
    lon: 28.68,
    region: 'Delmas, Mpumalanga · Open-Cast Pit',
    color: 'rgb(184, 134, 11)',
  },
  'BRAK-PLANT': {
    lat: -26.16,
    lon: 28.69,
    region: 'Delmas, Mpumalanga · Beneficiation Plant',
    color: 'rgb(16, 185, 129)',
  },
  'EXT-PIT': {
    lat: -26.18,
    lon: 28.72,
    region: 'Delmas, Mpumalanga · Extension Pit',
    color: 'rgb(2, 132, 199)',
  },
  'HEAD-OFFICE': {
    lat: -26.09,
    lon: 28.31,
    region: 'Bredell / Delmas, Mpumalanga Corridor',
    color: 'rgb(59, 130, 246)',
  },
};

export const DEFAULT_GLOBE_PINS: readonly GlobePin[] = [
  {
    id: 'brak-pit',
    siteCode: 'BRAK-PIT',
    label: 'Brakfontein Pit',
    region: 'Delmas, Mpumalanga · Open-Cast Pit',
    lat: -26.15,
    lon: 28.68,
    color: 'rgb(184, 134, 11)',
    status: 'online',
  },
  {
    id: 'brak-plant',
    siteCode: 'BRAK-PLANT',
    label: 'Brakfontein Plant',
    region: 'Delmas, Mpumalanga · Beneficiation Plant',
    lat: -26.16,
    lon: 28.69,
    color: 'rgb(16, 185, 129)',
    status: 'online',
  },
  {
    id: 'ext-pit',
    siteCode: 'EXT-PIT',
    label: 'Extension Pit',
    region: 'Delmas, Mpumalanga · Extension Pit',
    lat: -26.18,
    lon: 28.72,
    color: 'rgb(2, 132, 199)',
    status: 'online',
  },
  {
    id: 'head-office',
    siteCode: 'HEAD-OFFICE',
    label: 'Head Office',
    region: 'Bredell / Delmas, Mpumalanga Corridor',
    lat: -26.09,
    lon: 28.31,
    color: 'rgb(59, 130, 246)',
    status: 'online',
  },
];

function normalizeSiteCodeLookup(siteCode: string, siteName: string): string {
  const cleanCode = siteCode.trim().toUpperCase();
  if (cleanCode in MPUMALANGA_SITE_COORDINATES) {
    return cleanCode;
  }
  const normalizedName = siteName.trim().toLowerCase();
  if (normalizedName.includes('plant')) return 'BRAK-PLANT';
  if (normalizedName.includes('extension') || normalizedName.includes('ext')) return 'EXT-PIT';
  if (
    normalizedName.includes('head') ||
    normalizedName.includes('office') ||
    normalizedName.includes('bredell')
  ) {
    return 'HEAD-OFFICE';
  }
  if (normalizedName.includes('brakfontein') || normalizedName.includes('pit')) {
    return 'BRAK-PIT';
  }
  return cleanCode;
}

/** Resolve a real Supabase `public.sites` record into a Mpumalanga, South Africa 3D globe pin. */
export function resolveMpumalangaSitePin(site: OperationalSiteInput): GlobePin {
  const lookupKey = normalizeSiteCodeLookup(site.siteCode, site.name);
  const preset = MPUMALANGA_SITE_COORDINATES[lookupKey];
  const hash = Array.from(lookupKey || site.name).reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 97,
    0
  );
  const fallbackLat = MPUMALANGA_BASE_LAT - ((hash % 11) - 5) * 0.04;
  const fallbackLon = MPUMALANGA_BASE_LON + (((hash * 7) % 13) - 6) * 0.05;

  const activeBreakdowns = Math.max(0, site.activeBreakdowns ?? 0);
  const todayLoads = Math.max(0, site.todayLoads ?? 0);
  const status: GlobePin['status'] =
    activeBreakdowns > 0 ? 'alert' : site.active ? 'online' : 'standby';

  const alertsLabel = activeBreakdowns === 1 ? '1 alert' : `${activeBreakdowns} alerts`;
  const loadsLabel = todayLoads === 1 ? '1 load' : `${todayLoads} loads`;

  return {
    id: site.id,
    siteCode: site.siteCode,
    label: site.name,
    region: preset?.region ?? 'Mpumalanga Coalfields, South Africa',
    lat: preset?.lat ?? Number(fallbackLat.toFixed(2)),
    lon: preset?.lon ?? Number(fallbackLon.toFixed(2)),
    color: activeBreakdowns > 0 ? 'rgb(220, 38, 38)' : (preset?.color ?? 'rgb(184, 134, 11)'),
    status,
    telemetrySummary: `${loadsLabel} · ${alertsLabel}`,
  };
}

type PolygonRing = readonly (readonly [lonDeg: number, latDeg: number])[];

// Simplified real continental coastlines [lon, lat] ordered along perimeter.
const EARTH_LAND_POLYGONS: readonly PolygonRing[] = [
  // Africa
  [
    [-17.8, 14.7],
    [-16.0, 21.0],
    [-13.0, 27.5],
    [-6.0, 35.8],
    [10.5, 37.2],
    [12.0, 32.8],
    [25.0, 31.5],
    [32.5, 31.2],
    [34.5, 28.0],
    [43.2, 12.6],
    [51.4, 11.9],
    [49.0, 5.0],
    [41.0, -2.0],
    [40.5, -10.5],
    [35.0, -19.5],
    [32.9, -26.0],
    [28.0, -33.0],
    [18.2, -34.4],
    [14.0, -26.5],
    [13.4, -22.5],
    [11.8, -16.8],
    [12.2, -6.0],
    [9.4, 1.0],
    [8.5, 4.5],
    [3.0, 6.4],
    [-8.0, 4.5],
    [-13.5, 8.5],
    [-16.8, 12.2],
  ],
  // Madagascar
  [
    [49.3, -12.0],
    [50.4, -15.5],
    [47.5, -25.1],
    [44.0, -25.2],
    [43.3, -21.0],
    [44.5, -16.2],
    [47.8, -13.4],
  ],
  // Europe & Scandinavia
  [
    [-9.5, 37.0],
    [-9.3, 43.0],
    [-1.8, 43.4],
    [-4.7, 48.4],
    [2.0, 51.0],
    [8.6, 54.0],
    [8.2, 57.1],
    [5.0, 60.5],
    [10.5, 65.0],
    [20.0, 70.0],
    [28.5, 71.1],
    [40.0, 67.5],
    [44.0, 66.0],
    [58.0, 69.5],
    [60.0, 55.0],
    [46.0, 45.0],
    [39.0, 47.0],
    [34.0, 44.4],
    [29.0, 41.2],
    [26.0, 40.5],
    [23.5, 37.8],
    [19.5, 40.5],
    [18.3, 39.8],
    [15.6, 38.0],
    [12.2, 41.8],
    [13.8, 45.6],
    [7.5, 43.8],
    [3.2, 42.4],
    [-0.5, 38.5],
    [-5.6, 36.0],
  ],
  // UK & Ireland
  [
    [-6.0, 50.0],
    [-5.2, 54.8],
    [-6.0, 58.6],
    [-2.0, 57.7],
    [1.7, 52.5],
    [1.4, 51.1],
  ],
  // Asia & Siberia & India & SE Asia
  [
    [27.0, 41.0],
    [36.0, 36.8],
    [35.0, 31.5],
    [35.0, 29.0],
    [43.4, 12.7],
    [54.0, 16.5],
    [59.8, 22.5],
    [56.2, 26.2],
    [50.0, 29.5],
    [57.0, 25.4],
    [68.0, 23.7],
    [72.8, 19.0],
    [77.5, 8.1],
    [80.3, 13.0],
    [88.0, 22.0],
    [92.0, 20.8],
    [97.5, 16.5],
    [100.3, 13.5],
    [103.8, 1.3],
    [104.5, 8.6],
    [109.2, 12.8],
    [108.0, 21.5],
    [114.2, 22.3],
    [121.8, 31.2],
    [120.5, 36.0],
    [126.5, 35.1],
    [129.0, 35.2],
    [135.0, 44.0],
    [141.0, 53.0],
    [138.0, 56.0],
    [160.0, 53.0],
    [172.0, 62.0],
    [179.0, 66.5],
    [162.0, 70.0],
    [135.0, 71.5],
    [104.0, 77.5],
    [82.0, 73.5],
    [68.0, 69.5],
    [60.0, 69.5],
    [59.0, 52.0],
    [47.0, 44.5],
    [38.0, 42.0],
    [36.0, 41.2],
  ],
  // Japan
  [
    [130.0, 31.5],
    [136.0, 34.0],
    [140.8, 36.2],
    [145.5, 43.3],
    [141.5, 45.4],
    [139.5, 40.5],
    [136.5, 37.0],
    [131.0, 34.0],
  ],
  // Indonesia / Borneo / Sumatra / New Guinea
  [
    [95.3, 5.5],
    [104.5, -1.0],
    [105.8, -6.5],
    [114.5, -8.5],
    [109.0, -3.5],
    [117.5, -4.0],
    [118.5, 4.5],
    [112.0, 2.5],
    [102.5, 1.5],
  ],
  [
    [131.0, -1.5],
    [141.0, -2.5],
    [150.5, -10.5],
    [142.5, -9.2],
    [136.0, -5.0],
  ],
  // Australia
  [
    [113.5, -22.5],
    [122.2, -17.9],
    [130.8, -12.4],
    [136.8, -12.3],
    [141.5, -15.5],
    [142.5, -10.7],
    [149.0, -20.5],
    [153.6, -28.2],
    [151.3, -33.9],
    [147.8, -37.9],
    [138.5, -35.6],
    [129.0, -31.8],
    [115.0, -34.4],
    [114.6, -28.0],
  ],
  // New Zealand
  [
    [172.4, -34.4],
    [178.5, -37.7],
    [175.6, -41.5],
    [166.5, -46.2],
    [170.5, -43.0],
    [174.0, -39.0],
  ],
  // North & Central America
  [
    [-168.0, 65.5],
    [-156.5, 71.3],
    [-136.0, 69.5],
    [-110.0, 72.0],
    [-82.0, 70.0],
    [-64.0, 63.0],
    [-55.6, 52.0],
    [-60.0, 46.5],
    [-67.0, 44.8],
    [-70.5, 41.8],
    [-75.5, 39.8],
    [-75.6, 35.2],
    [-80.2, 25.8],
    [-82.8, 28.0],
    [-89.0, 30.0],
    [-97.2, 26.0],
    [-96.0, 19.2],
    [-90.5, 21.2],
    [-87.0, 21.4],
    [-83.5, 15.0],
    [-77.5, 8.5],
    [-80.0, 7.5],
    [-85.5, 10.5],
    [-92.2, 14.5],
    [-105.5, 20.5],
    [-110.0, 23.0],
    [-117.1, 32.5],
    [-122.4, 37.8],
    [-124.7, 48.4],
    [-135.0, 57.0],
    [-150.0, 60.0],
    [-162.0, 55.0],
    [-166.0, 60.0],
  ],
  // South America
  [
    [-77.5, 8.8],
    [-71.5, 12.2],
    [-62.0, 10.6],
    [-50.0, 1.5],
    [-35.0, -5.8],
    [-38.5, -13.0],
    [-40.5, -21.5],
    [-48.5, -28.0],
    [-53.5, -34.0],
    [-62.0, -40.5],
    [-67.5, -54.8],
    [-73.5, -52.5],
    [-74.0, -43.0],
    [-71.6, -33.0],
    [-70.3, -18.5],
    [-77.2, -12.0],
    [-81.3, -4.7],
    [-78.0, 2.0],
  ],
  // Greenland
  [
    [-44.0, 60.0],
    [-22.0, 70.0],
    [-18.0, 81.5],
    [-55.0, 82.0],
    [-70.0, 76.5],
    [-52.0, 68.0],
  ],
];

let cachedEarthDots: readonly SurfaceDot[] | null = null;

/** Convert geographic coordinates (degrees) into a unit 3D vector (+Z toward prime equator). */
export function latLonToUnitVec3(latDeg: number, lonDeg: number): Vec3 {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.sin(lonRad),
    y: Math.sin(latRad),
    z: cosLat * Math.cos(lonRad),
  };
}

/** Rotate a 3D point by orbit yaw (Y-axis) then pitch (X-axis) into camera space. */
export function rotateVec3(point: Vec3, orbit: OrbitAngles): Vec3 {
  const cosYaw = Math.cos(orbit.yawRad);
  const sinYaw = Math.sin(orbit.yawRad);
  const xAfterYaw = point.x * cosYaw - point.z * sinYaw;
  const zAfterYaw = point.x * sinYaw + point.z * cosYaw;

  const cosPitch = Math.cos(orbit.pitchRad);
  const sinPitch = Math.sin(orbit.pitchRad);
  const yAfterPitch = point.y * cosPitch - zAfterYaw * sinPitch;
  const zAfterPitch = point.y * sinPitch + zAfterYaw * cosPitch;

  return {
    x: xAfterYaw,
    y: yAfterPitch,
    z: zAfterPitch,
  };
}

/** Project a rotated 3D vector onto 2D viewport coordinates with true perspective scaling. */
export function projectVec3ToScreen(point: Vec3, viewport: GlobeViewport): ProjectedPoint3D {
  const cameraDist = viewport.cameraDistanceMult ?? CAMERA_DISTANCE_MULT;
  const rawPerspective = cameraDist / Math.max(0.25, cameraDist - point.z);
  const scale = rawPerspective / LIMB_SCALE_NORM;
  const pixelScale = viewport.radiusPx * scale;

  return {
    screenX: viewport.centerX + point.x * pixelScale,
    screenY: viewport.centerY - point.y * pixelScale,
    scale,
    depthZ: point.z,
    isFront: point.z > 0,
  };
}

/** Clamp orbit pitch so the camera never flips upside-down across the poles. */
export function clampPitchRad(pitchRad: number): number {
  return Math.max(MIN_PITCH_RAD, Math.min(MAX_PITCH_RAD, pitchRad));
}

/** Compute orbit angles that rotate the given geographic coordinate directly to face +Z. */
export function targetOrbitForLatLon(latDeg: number, lonDeg: number): OrbitAngles {
  return {
    yawRad: lonDeg * DEG_TO_RAD,
    pitchRad: clampPitchRad(latDeg * DEG_TO_RAD),
  };
}

/** Shortest signed angular delta in radians within [-PI, PI]. */
export function shortestAngleDelta(currentRad: number, targetRad: number): number {
  const normalized =
    ((((targetRad - currentRad) % FULL_CIRCLE_RAD) + FULL_CIRCLE_RAD + Math.PI) % FULL_CIRCLE_RAD) -
    Math.PI;
  return normalized;
}

function isPointInPolygon(lonDeg: number, latDeg: number, ring: PolygonRing): boolean {
  let isInside = false;
  let prevIndex = ring.length - 1;
  for (let index = 0; index < ring.length; index += 1) {
    const vertex = ring[index];
    const prevVertex = ring[prevIndex];
    if (!vertex || !prevVertex) continue;
    const vx = vertex[0];
    const vy = vertex[1];
    const px = prevVertex[0];
    const py = prevVertex[1];
    const crossesLat = vy > latDeg !== py > latDeg;
    const intersectLon = ((px - vx) * (latDeg - vy)) / (py - vy || 1e-9) + vx;
    if (crossesLat && lonDeg < intersectLon) {
      isInside = !isInside;
    }
    prevIndex = index;
  }
  return isInside;
}

/** Return true if (latDeg, lonDeg) lies within simplified continental landmasses. */
export function isLandCoordinate(latDeg: number, lonDeg: number): boolean {
  if (Math.abs(latDeg) > POLE_THRESHOLD_LAT) {
    return false;
  }
  for (const polygon of EARTH_LAND_POLYGONS) {
    if (isPointInPolygon(lonDeg, latDeg, polygon)) {
      return true;
    }
  }
  return false;
}

/** Generate and cache unit-sphere surface dots filtered to Earth continental landmasses. */
export function buildEarthSurfaceDots(dotCount = FIBONACCI_DOT_COUNT): readonly SurfaceDot[] {
  if (dotCount === FIBONACCI_DOT_COUNT && cachedEarthDots !== null) {
    return cachedEarthDots;
  }

  const dots: SurfaceDot[] = [];
  for (let index = 0; index < dotCount; index += 1) {
    const y = 1 - (index / (dotCount - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE_RAD * index;
    const x = Math.sin(theta) * radiusAtY;
    const z = Math.cos(theta) * radiusAtY;
    const latDeg = Math.asin(y) / DEG_TO_RAD;
    const lonDeg = Math.atan2(x, z) / DEG_TO_RAD;
    if (isLandCoordinate(latDeg, lonDeg)) {
      dots.push({ unitVec: { x, y, z } });
    }
  }

  if (dotCount === FIBONACCI_DOT_COUNT) {
    cachedEarthDots = dots;
  }
  return dots;
}

/** Sample points along an elevated 3D spherical linear interpolation arc between two unit vectors. */
export function sampleGeodesicArc(options: {
  readonly startVec: Vec3;
  readonly endVec: Vec3;
  readonly segmentCount: number;
  readonly peakAltitude: number;
}): readonly Vec3[] {
  const { startVec, endVec, segmentCount, peakAltitude } = options;
  const dotProduct = Math.max(
    -1,
    Math.min(1, startVec.x * endVec.x + startVec.y * endVec.y + startVec.z * endVec.z)
  );
  const omega = Math.acos(dotProduct);
  const sinOmega = Math.sin(omega);
  const points: Vec3[] = [];

  for (let step = 0; step <= segmentCount; step += 1) {
    const progress = step / segmentCount;
    const weightA = sinOmega > 1e-4 ? Math.sin((1 - progress) * omega) / sinOmega : 1 - progress;
    const weightB = sinOmega > 1e-4 ? Math.sin(progress * omega) / sinOmega : progress;
    const radialAltitude = 1 + peakAltitude * Math.sin(Math.PI * progress);

    const rawX = weightA * startVec.x + weightB * endVec.x;
    const rawY = weightA * startVec.y + weightB * endVec.y;
    const rawZ = weightA * startVec.z + weightB * endVec.z;
    const norm = Math.hypot(rawX, rawY, rawZ) || 1;

    points.push({
      x: (rawX / norm) * radialAltitude,
      y: (rawY / norm) * radialAltitude,
      z: (rawZ / norm) * radialAltitude,
    });
  }

  return points;
}

/** Compute local East and North unit tangent vectors on the sphere at a geographic location. */
export function getSurfaceTangents(
  latDeg: number,
  lonDeg: number
): {
  readonly eastVec: Vec3;
  readonly northVec: Vec3;
} {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  return {
    eastVec: {
      x: Math.cos(lonRad),
      y: 0,
      z: -Math.sin(lonRad),
    },
    northVec: {
      x: -Math.sin(latRad) * Math.sin(lonRad),
      y: Math.cos(latRad),
      z: -Math.sin(latRad) * Math.cos(lonRad),
    },
  };
}

/** Normalize yaw into [-PI, PI] radians so orbit interpolation stays bounded. */
export function normalizeYawRad(yawRad: number): number {
  return ((((yawRad + Math.PI) % FULL_CIRCLE_RAD) + FULL_CIRCLE_RAD) % FULL_CIRCLE_RAD) - Math.PI;
}

/** Format geographic coordinates cleanly for display badges. */
export function formatCoordinates(latDeg: number, lonDeg: number): string {
  const latHemisphere = latDeg >= 0 ? 'N' : 'S';
  const lonHemisphere = lonDeg >= 0 ? 'E' : 'W';
  return `${Math.abs(latDeg).toFixed(1)}°${latHemisphere}, ${Math.abs(lonDeg).toFixed(1)}°${lonHemisphere}`;
}
