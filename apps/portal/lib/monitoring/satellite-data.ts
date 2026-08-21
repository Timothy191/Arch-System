import { createServerSupabaseClient } from "@repo/supabase/server";
import { cacheGet, cacheSet } from "@repo/redis/cache";
import {
  DEFAULT_MINE_BBOX,
  fetchSentinel1Scenes,
  fetchSentinel2Scenes,
  mapDeformationRowsToReadings,
  type DeformationDbRow,
  type DeformationReading,
  type STACItem,
} from "@repo/shared/data-access";

// AGENT-TRACE: Server-side data fetcher for the Satellite Monitoring dashboards.
// Server-only by usage: every importer is an async Server Component / route, so
// this module never reaches the client bundle. All Copernicus STAC calls happen
// here (server) so the browser never hits the STAC endpoint directly (avoids
// CORS and lets Next's fetch cache work). Deformation rows are always read from
// the `satellite-monitoring` department regardless of which page renders the
// dashboard — that department owns the InSAR data and RLS gates access to its
// rows.

const SAT_DEPT_SLUG = "satellite-monitoring";
const DEPT_UUID_CACHE_KEY = "dept:uuid:satellite-monitoring";
const DEPT_UUID_TTL = 3600; // 1 hour — matches dept-context.ts

export interface SatelliteMonitoringData {
  readings: DeformationReading[];
  s1Scenes: STACItem[];
  s2Scenes: STACItem[];
  latestS2Pass: string | null;
  /** Human-readable provenance label for honest UI disclosure. */
  dataSource: string;
}

/**
 * Resolve the `satellite-monitoring` department UUID, using Redis to cache the
 * lookup (mirrors the pattern in dept-context.ts).
 */
async function resolveSatelliteDeptId(): Promise<string | null> {
  const cached = await cacheGet<string>(DEPT_UUID_CACHE_KEY);
  if (cached) return cached;

  const supabase = await createServerSupabaseClient();
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("name", SAT_DEPT_SLUG)
    .maybeSingle();

  if (!dept) return null;
  await cacheSet(DEPT_UUID_CACHE_KEY, dept.id, DEPT_UUID_TTL);
  return dept.id;
}

/**
 * Fetch everything the Satellite Monitoring dashboards need, server-side:
 *  - persisted InSAR deformation points (mapped to DeformationReadings)
 *  - live Sentinel-1 SAR scenes from Copernicus STAC
 *  - live Sentinel-2 optical scenes (cloud-filtered) from Copernicus STAC
 *
 * Returns honest empty values when no data exists — callers render an empty
 * state, never fabricated readings.
 */
export async function getSatelliteMonitoringData(): Promise<SatelliteMonitoringData> {
  const deptId = await resolveSatelliteDeptId();

  // Fetch DB rows and STAC scenes concurrently — independent I/O.
  const [readings, s1Scenes, s2Scenes] = await Promise.all([
    deptId ? fetchDeformationReadings(deptId) : Promise.resolve([]),
    fetchSentinel1Scenes(DEFAULT_MINE_BBOX, 14),
    fetchSentinel2Scenes(DEFAULT_MINE_BBOX, 30, 14),
  ]);

  // AGENT-TRACE: latestS2Pass is the most recent scene datetime actually
  // returned by STAC — never a fabricated "3 days ago" value.
  const latestS2Pass = s2Scenes.length
    ? s2Scenes.reduce((latest, s) => {
        const dt = s.properties.datetime;
        return !latest || dt > latest ? dt : latest;
      }, "")
    : null;

  const dataSource =
    readings.length > 0
      ? "Supabase (ingested InSAR) + Copernicus STAC (live scenes)"
      : "Copernicus STAC (live scenes only — no InSAR ingested yet)";

  return { readings, s1Scenes, s2Scenes, latestS2Pass, dataSource };
}

async function fetchDeformationReadings(deptId: string): Promise<DeformationReading[]> {
  const supabase = await createServerSupabaseClient();
  // AGENT-TRACE: RLS gates this read to users with access to the
  // satellite-monitoring department (is_admin() OR has_department_access).
  // Order ascending — the adapter re-sorts per group, but a stable feed helps.
  const { data, error } = await supabase
    .from("satellite_deformations")
    .select("*")
    .eq("department_id", deptId)
    .order("acquisition_date", { ascending: true })
    .limit(500);

  if (error) {
    // Surface the failure honestly rather than falling back to mock data.
    // eslint-disable-next-line no-console
    console.warn("[satellite-data] deformation query failed:", error.message);
    return [];
  }

  return mapDeformationRowsToReadings((data ?? []) as unknown as DeformationDbRow[]);
}
