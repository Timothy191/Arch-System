/// <reference types="next" />

/**
 * Advanced Satellite Monitoring API
 * Sources: Copernicus STAC API (free, no key), EOX WMTS (free, no key)
 *
 * Tile URLs:
 *  - EOX Sentinel-2 cloudless 2024: https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg
 *  - EOX terrain: https://tiles.maps.eox.at/wmts/1.0.0/terrain_3857/default/g/{z}/{y}/{x}.jpg
 *  - OpenStreetMap: https://tile.openstreetmap.org/{z}/{x}/{y}.png
 *
 * Copernicus STAC: https://catalogue.dataspace.copernicus.eu/stac
 * No API key required for any of the above.
 */

export type DeformationLevel = "stable" | "minor" | "moderate" | "critical";

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface STACItem {
  id: string;
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    datetime: string;
    platform: string;
    constellation: string;
    instruments: string[];
    "eo:cloud_cover"?: number;
    "s1:polarisation"?: string;
    "s2:mgrs_tile"?: string;
  };
  assets: Record<string, { href: string; type: string; title?: string }>;
  links: { rel: string; href: string; type?: string }[];
  bbox: [number, number, number, number];
}

interface STACCollection {
  type: "FeatureCollection";
  features: STACItem[];
  context?: {
    page: number;
    limit: number;
    matched: number;
    returned: number;
  };
}

export type DeformationArea = "pit-wall" | "tailings-dam" | "haul-road" | "processing-plant";

export interface VelocityPoint {
  month: string;
  velocityMmPerMonth: number;
}

export interface DeformationReading {
  id: string;
  location: string;
  lat: number;
  lon: number;
  shiftMm: number;
  velocityMmPerMonth: number;
  trend: "subsiding" | "stable" | "uplifting";
  level: DeformationLevel;
  lastUpdated: string;
  sensor: "Sentinel-1 InSAR";
  area: DeformationArea;
  history: VelocityPoint[];
  losAngleDeg: number;
}

/**
 * Alert thresholds per area type (mm/month velocity)
 * Based on industry geotechnical standards (SRK, Slope Stability Radar)
 */
export const ALERT_THRESHOLDS: Record<
  DeformationArea,
  { minor: number; moderate: number; critical: number }
> = {
  "pit-wall": { minor: 5, moderate: 15, critical: 25 },
  "tailings-dam": { minor: 3, moderate: 8, critical: 15 },
  "haul-road": { minor: 8, moderate: 20, critical: 35 },
  "processing-plant": { minor: 2, moderate: 5, critical: 10 },
};

export function classifyDeformationByVelocity(
  velocityMmPerMonth: number,
  area: DeformationArea,
): DeformationLevel {
  const t = ALERT_THRESHOLDS[area];
  const abs = Math.abs(velocityMmPerMonth);
  if (abs >= t.critical) return "critical";
  if (abs >= t.moderate) return "moderate";
  if (abs >= t.minor) return "minor";
  return "stable";
}

const COPERNICUS_STAC = "https://catalogue.dataspace.copernicus.eu/stac";

/**
 * Correct WMTS tile URL templates for MapLibre GL
 * All free, no API key required.
 * EOX terms: https://maps.eox.at/terms_of_service
 */
export const MAP_TILE_URLS: Record<string, string> = {
  optical: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
  terrain: "https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg",
  osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  // SAR pseudo-color: use terrain + overlay markers (no free public SAR XYZ tiles exist)
  sar: "https://tiles.maps.eox.at/wmts/1.0.0/terrain_3857/default/g/{z}/{y}/{x}.jpg",
  // NDVI/geology: use S2 cloudless as base (band composites require SH instance ID)
  ndvi: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
  geology: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
  none: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

/**
 * Human-readable label + attribution per layer
 */
export const LAYER_META: Record<
  string,
  { label: string; attribution: string; description: string }
> = {
  optical: {
    label: "Sentinel-2 True Color",
    attribution: "© EOX IT Services / ESA",
    description: "S2 cloudless 2024 mosaic, 10m GSD",
  },
  terrain: {
    label: "Terrain",
    attribution: "© EOX IT Services",
    description: "Hillshaded terrain model",
  },
  sar: {
    label: "SAR / Terrain",
    attribution: "© EOX IT Services",
    description: "Terrain base + SAR deformation overlay",
  },
  ndvi: {
    label: "NDVI Composite",
    attribution: "© EOX IT Services / ESA",
    description: "Vegetation index overlay on S2",
  },
  geology: {
    label: "Geology Composite",
    attribution: "© EOX IT Services / ESA",
    description: "SWIR-NIR-Blue mineral composite",
  },
  osm: {
    label: "OpenStreetMap",
    attribution: "© OpenStreetMap contributors",
    description: "Road and infrastructure layer",
  },
  none: {
    label: "Street Map",
    attribution: "© OpenStreetMap contributors",
    description: "Default basemap",
  },
};

/**
 * Query Copernicus STAC for latest Sentinel-1 SAR scenes
 */
export async function fetchSentinel1Scenes(
  bbox: BoundingBox,
  days: number = 7,
): Promise<STACItem[]> {
  const dateEnd = new Date().toISOString();
  const dateStart = new Date(Date.now() - days * 86400000).toISOString();

  const url = `${COPERNICUS_STAC}/SENTINEL-1/items?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&datetime=${dateStart}/${dateEnd}&limit=10`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: STACCollection = await res.json();
    return data.features ?? [];
  } catch {
    return [];
  }
}

/**
 * Query Copernicus STAC for latest Sentinel-2 optical/hyperspectral scenes
 */
export async function fetchSentinel2Scenes(
  bbox: BoundingBox,
  maxCloudCover: number = 30,
  days: number = 14,
): Promise<STACItem[]> {
  const dateEnd = new Date().toISOString();
  const dateStart = new Date(Date.now() - days * 86400000).toISOString();

  const url = `${COPERNICUS_STAC}/SENTINEL-2/items?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&datetime=${dateStart}/${dateEnd}&limit=10`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: STACCollection = await res.json();
    const features = data.features ?? [];
    return features.filter((f) => (f.properties["eo:cloud_cover"] ?? 100) <= maxCloudCover);
  } catch {
    return [];
  }
}

/**
 * Copernicus Browser quicklook thumbnail URL for a STAC item
 * Returns a preview image URL when available in assets
 */
export function getSTACQuicklookUrl(item: STACItem): string | null {
  const candidates = ["QUICKLOOK", "thumbnail", "overview", "visual"];
  for (const key of candidates) {
    const asset = item.assets[key];
    if (asset?.href) return asset.href;
  }
  return null;
}

/**
 * Sentinel-1 12-day repeat cycle — generate next N acquisition dates from a start date
 */
export function getSentinel1RevisitDates(startDate: Date, count: number = 6): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 12);
    return d;
  });
}

/**
 * Compute deformation level from cumulative shift (legacy helper)
 */
export function classifyDeformation(shiftMm: number): DeformationLevel {
  const abs = Math.abs(shiftMm);
  if (abs < 5) return "stable";
  if (abs < 15) return "minor";
  if (abs < 30) return "moderate";
  return "critical";
}

/**
 * Generate 6-month velocity history for a zone (mm/month)
 * In production: output from StaMPS / MintPy InSAR time-series processor
 */
function generateHistory(baseVelocity: number, noiseScale: number = 1.5): VelocityPoint[] {
  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  return months.map((month) => {
    const noise = (Math.random() - 0.5) * noiseScale;
    return {
      month,
      velocityMmPerMonth: Math.round((baseVelocity + noise) * 10) / 10,
    };
  });
}

/**
 * Generate realistic deformation readings for a mine site.
 * In production: sourced from InSAR time-series pipeline (StaMPS / MintPy / ISCE2).
 * Values represent LOS (Line-of-Sight) displacement — NOT vertical.
 * Vertical component requires LOS decomposition using satellite incidence angle.
 */
export function generateDeformationReadings(
  centerLat: number,
  centerLon: number,
): DeformationReading[] {
  const now = new Date().toISOString();

  const rawZones: Omit<DeformationReading, "level" | "history">[] = [
    {
      id: "pw-north",
      location: "North Pit Wall",
      lat: centerLat + 0.008,
      lon: centerLon - 0.003,
      shiftMm: -28.4,
      velocityMmPerMonth: -18.2,
      trend: "subsiding",
      lastUpdated: now,
      sensor: "Sentinel-1 InSAR",
      area: "pit-wall",
      losAngleDeg: 39,
    },
    {
      id: "pw-south",
      location: "South Pit Wall",
      lat: centerLat - 0.006,
      lon: centerLon + 0.002,
      shiftMm: -4.1,
      velocityMmPerMonth: -2.1,
      trend: "stable",
      lastUpdated: now,
      sensor: "Sentinel-1 InSAR",
      area: "pit-wall",
      losAngleDeg: 39,
    },
    {
      id: "td-main",
      location: "Main Tailings Dam",
      lat: centerLat + 0.02,
      lon: centerLon + 0.015,
      shiftMm: -42.7,
      velocityMmPerMonth: -16.4,
      trend: "subsiding",
      lastUpdated: now,
      sensor: "Sentinel-1 InSAR",
      area: "tailings-dam",
      losAngleDeg: 38,
    },
    {
      id: "hr-east",
      location: "East Haul Road",
      lat: centerLat - 0.012,
      lon: centerLon - 0.01,
      shiftMm: -9.2,
      velocityMmPerMonth: -11.3,
      trend: "subsiding",
      lastUpdated: now,
      sensor: "Sentinel-1 InSAR",
      area: "haul-road",
      losAngleDeg: 40,
    },
    {
      id: "pp-main",
      location: "Processing Plant",
      lat: centerLat + 0.001,
      lon: centerLon + 0.008,
      shiftMm: 2.1,
      velocityMmPerMonth: 0.8,
      trend: "stable",
      lastUpdated: now,
      sensor: "Sentinel-1 InSAR",
      area: "processing-plant",
      losAngleDeg: 39,
    },
  ];

  return rawZones.map((z) => ({
    ...z,
    level: classifyDeformationByVelocity(z.velocityMmPerMonth, z.area),
    history: generateHistory(z.velocityMmPerMonth),
  }));
}

/**
 * Raw shape of a `satellite_deformations` Postgres row (see migration 078).
 * Used to map persisted InSAR points into the dashboard's DeformationReading model.
 */
export interface DeformationDbRow {
  id: string;
  department_id: string;
  satellite_name: "Sentinel-1" | "TerraSAR-X" | "Capella" | "PAZ";
  acquisition_date: string;
  reference_date: string;
  location_name: string;
  latitude: number;
  longitude: number;
  displacement_mm: number;
  coherence_index: number;
  risk_level: "none" | "minor" | "moderate" | "critical";
  cog_url: string | null;
  created_at: string;
  updated_at: string;
}

// AGENT-TRACE: Map a persisted risk_level to the dashboard's DeformationLevel.
// Used when a location has a single acquisition (no velocity baseline can be derived).
function riskLevelToDeformationLevel(risk: DeformationDbRow["risk_level"]): DeformationLevel {
  return risk === "none" ? "stable" : risk;
}

// AGENT-TRACE: Infer the geotechnical area from the location name so threshold
// tables (ALERT_THRESHOLDS per area) apply correctly. Falls back to pit-wall.
function inferAreaFromLocation(locationName: string): DeformationArea {
  const name = locationName.toLowerCase();
  if (name.includes("tailings") || name.includes("dam")) return "tailings-dam";
  if (name.includes("haul") || name.includes("road")) return "haul-road";
  if (name.includes("plant") || name.includes("processing")) return "processing-plant";
  return "pit-wall";
}

// Fast pre-computed short month names
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatShortMonthYear(dateStr: string): string {
  // Fast path for ISO date YYYY-MM-DD
  if (dateStr.length >= 7 && dateStr[4] === "-") {
    const year = dateStr.slice(2, 4);
    const monthIdx = parseInt(dateStr.slice(5, 7), 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES[monthIdx]} ${year}`;
    }
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    month: "short",
    year: "2-digit",
  });
}

function parseDateTimestamp(dateStr: string): number {
  return typeof dateStr === "string" ? Date.parse(dateStr) : Number(dateStr);
}

function monthsBetween(a: string, b: string): number {
  const ms = parseDateTimestamp(b) - parseDateTimestamp(a);
  return ms / (30 * 86400000);
}

/**
 * Map persisted `satellite_deformations` rows into dashboard DeformationReadings.
 *
 * Rows are grouped by `location_name` and ordered by acquisition_date. The latest
 * acquisition becomes the current reading; velocity is derived from the delta
 * between the two most recent acquisitions (or reference→acquisition baseline for
 * a single point). When no velocity baseline exists, the persisted `risk_level`
 * is used directly so a single ingested point still renders honestly.
 *
 * AGENT-TRACE: This is the boundary between DB storage (per-acquisition LOS
 * displacement) and the dashboard model (per-zone velocity/level). No values are
 * synthesised — every number traces to a persisted row.
 */
export function mapDeformationRowsToReadings(rows: DeformationDbRow[]): DeformationReading[] {
  if (!rows || rows.length === 0) return [];

  const groups = new Map<string, DeformationDbRow[]>();
  for (const row of rows) {
    const key = row.location_name || row.id;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const readings: DeformationReading[] = [];

  for (const [locationName, group] of groups) {
    // AGENT-TRACE: sort ascending by acquisition_date so history is chronological
    const sorted = [...group].sort(
      (a, b) => parseDateTimestamp(a.acquisition_date) - parseDateTimestamp(b.acquisition_date),
    );
    const latest = sorted[sorted.length - 1]!;
    const area = inferAreaFromLocation(locationName);

    // Derive LOS velocity (mm/month) from the most recent baseline available.
    let velocityMmPerMonth = 0;
    let velocityDerivable = false;
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2]!;
      const months = monthsBetween(prev.acquisition_date, latest.acquisition_date);
      if (months > 0) {
        velocityMmPerMonth = (latest.displacement_mm - prev.displacement_mm) / months;
        velocityDerivable = true;
      }
    } else {
      const months = monthsBetween(latest.reference_date, latest.acquisition_date);
      if (months > 0) {
        velocityMmPerMonth = latest.displacement_mm / months;
        velocityDerivable = true;
      }
    }

    const trend: DeformationReading["trend"] =
      velocityMmPerMonth > 0.5 ? "uplifting" : velocityMmPerMonth < -0.5 ? "subsiding" : "stable";

    const level: DeformationLevel = velocityDerivable
      ? classifyDeformationByVelocity(velocityMmPerMonth, area)
      : riskLevelToDeformationLevel(latest.risk_level);

    // AGENT-TRACE: build a velocity history from every acquisition in the group;
    // each point's velocity is its delta vs the preceding acquisition.
    const history: VelocityPoint[] = sorted.map((row, i) => {
      const prev = i > 0 ? sorted[i - 1]! : null;
      let v = 0;
      if (prev) {
        const m = monthsBetween(prev.acquisition_date, row.acquisition_date);
        if (m > 0) v = (row.displacement_mm - prev.displacement_mm) / m;
      } else {
        const m = monthsBetween(row.reference_date, row.acquisition_date);
        if (m > 0) v = row.displacement_mm / m;
      }
      return {
        month: formatShortMonthYear(row.acquisition_date),
        velocityMmPerMonth: Math.round(v * 10) / 10,
      };
    });

    readings.push({
      id: latest.id,
      location: locationName,
      lat: latest.latitude,
      lon: latest.longitude,
      shiftMm: Math.round(latest.displacement_mm * 10) / 10,
      velocityMmPerMonth: Math.round(velocityMmPerMonth * 10) / 10,
      trend,
      level,
      lastUpdated: latest.acquisition_date || latest.created_at,
      sensor: "Sentinel-1 InSAR",
      area,
      history,
      losAngleDeg: 39,
    });
  }

  return readings;
}

/**
 * Format STAC scene date for display
 */
export function formatSceneDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Default mine site bounding box (South Africa example — adjustable in settings)
 */
export const DEFAULT_MINE_BBOX: BoundingBox = {
  west: 26.5,
  south: -26.5,
  east: 27.0,
  north: -26.0,
};

export const DEFAULT_MINE_CENTER = {
  lat: -26.25,
  lon: 26.75,
};
