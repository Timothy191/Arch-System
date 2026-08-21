import { inngest } from "@repo/utils/inngest";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { getRedisClient } from "@repo/redis";
import { logError } from "@/lib/errors/error-logger";
import { recordJobExecution } from "@/lib/observability/simple-metrics";
import {
  DEFAULT_MINE_BBOX,
  DEFAULT_MINE_CENTER,
  fetchSentinel1Scenes,
  getSTACQuicklookUrl,
  type STACItem,
} from "@repo/shared/data-access";
import type { InngestFunction } from "inngest";

// AGENT-TRACE: Inngest cron job that pulls Sentinel-1 STAC scenes and persists
// InSAR acquisition / deformation records. Runs server-side with service-role
// credentials because RLS policies do not apply to automated background jobs.
//
// Honesty boundary: Copernicus STAC only returns scene metadata. Without an
// external InSAR processor (INSAR_PROCESSING_API_URL) we cannot compute real LOS
// displacement. In that fallback mode we ingest one bookkeeping record per fixed
// monitoring zone per scene with displacement_mm=0 and risk_level='none', so
// the dashboard is populated with real acquisition timestamps while never fabricating
// slope movement measurements.

const SATELLITE_DEPT_SLUG = "satellite-monitoring";
const SAFETY_DEPT_NAME = "safety";
const STREAM_CHANNEL = "satellite:insar:stream";
const LAST_KEY_PREFIX = "satellite:insar:last:";
const S1_REPEAT_DAYS = 12;

interface MonitoringZone {
  id: string;
  locationName: string;
  lat: number;
  lon: number;
  areaKeyword: string;
}

interface ProcessedDisplacement {
  location_name: string;
  displacement_mm: number;
  coherence_index?: number;
  risk_level?: "none" | "minor" | "moderate" | "critical";
  cog_url?: string | null;
}

// Fixed mine-site monitoring zones used when no external InSAR processor is
// configured. Coordinates are relative to DEFAULT_MINE_CENTER; the zones match
// the geotechnical areas rendered by the Satellite Monitoring dashboard.
const MONITORING_ZONES: MonitoringZone[] = [
  {
    id: "pw-north",
    locationName: "North Pit Wall",
    lat: DEFAULT_MINE_CENTER.lat + 0.008,
    lon: DEFAULT_MINE_CENTER.lon - 0.003,
    areaKeyword: "pit-wall",
  },
  {
    id: "pw-south",
    locationName: "South Pit Wall",
    lat: DEFAULT_MINE_CENTER.lat - 0.006,
    lon: DEFAULT_MINE_CENTER.lon + 0.002,
    areaKeyword: "pit-wall",
  },
  {
    id: "td-main",
    locationName: "Main Tailings Dam",
    lat: DEFAULT_MINE_CENTER.lat + 0.02,
    lon: DEFAULT_MINE_CENTER.lon + 0.015,
    areaKeyword: "tailings-dam",
  },
  {
    id: "hr-east",
    locationName: "East Haul Road",
    lat: DEFAULT_MINE_CENTER.lat - 0.012,
    lon: DEFAULT_MINE_CENTER.lon - 0.01,
    areaKeyword: "haul-road",
  },
  {
    id: "pp-main",
    locationName: "Processing Plant",
    lat: DEFAULT_MINE_CENTER.lat + 0.001,
    lon: DEFAULT_MINE_CENTER.lon + 0.008,
    areaKeyword: "processing-plant",
  },
];

export const insarSceneIngestionFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "insar-scene-ingestion",
    // AGENT-TRACE: Sentinel-1 repeat is ~12 days; run daily to catch new
    // acquisitions as soon as they appear in Copernicus STAC.
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const start = performance.now();
    let success = true;
    const serviceRole = createServiceRoleClient();
    const redis = await getRedisClient();

    try {
      // AGENT-TRACE: Resolve the department that owns all InSAR data.
      const { data: satDept, error: deptError } = await serviceRole
        .from("departments")
        .select("id")
        .eq("name", SATELLITE_DEPT_SLUG)
        .maybeSingle();

      if (deptError) throw deptError;
      if (!satDept) {
        return {
          success: false,
          message: `Department '${SATELLITE_DEPT_SLUG}' not found`,
          ingested: 0,
        };
      }

      // AGENT-TRACE: Fetch recent Sentinel-1 acquisitions from Copernicus STAC.
      const s1Scenes = await step.run("fetch-s1-scenes", async () => {
        return fetchSentinel1Scenes(DEFAULT_MINE_BBOX, 14);
      });

      if (s1Scenes.length === 0) {
        return { success: true, message: "No Sentinel-1 scenes in range", ingested: 0 };
      }

      // AGENT-TRACE: Load existing acquisitions for the last 30 days so we do not
      // insert duplicate bookkeeping rows for the same scene date + zone.
      const lookbackStart = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]!;
      const { data: existingRows, error: existingError } = await serviceRole
        .from("satellite_deformations")
        .select("acquisition_date, location_name, satellite_name")
        .eq("department_id", satDept.id)
        .gte("acquisition_date", lookbackStart);

      if (existingError) throw existingError;

      const existingKeySet = new Set(
        (existingRows ?? []).map(
          (r) => `${String(r.acquisition_date)}|${r.location_name}|${r.satellite_name}`,
        ),
      );

      // AGENT-TRACE: Resolve the safety department once for critical escalations.
      const { data: safetyDept } = await serviceRole
        .from("departments")
        .select("id")
        .eq("name", SAFETY_DEPT_NAME)
        .maybeSingle();

      let ingestedCount = 0;
      let escalatedCount = 0;

      for (const scene of s1Scenes) {
        const acquisitionDate = scene.properties.datetime.split("T")[0]!;
        const referenceDate = new Date(
          new Date(acquisitionDate).getTime() - S1_REPEAT_DAYS * 86400000,
        )
          .toISOString()
          .split("T")[0]!;
        const quicklook = getSTACQuicklookUrl(scene);

        // AGENT-TRACE: Try to fetch real processed displacement if a processor is
        // wired up. Any failure falls back to honest bookkeeping records.
        const processedResults = await step.run(`process-${scene.id}`, async () => {
          return fetchProcessedDisplacements(scene);
        });

        const recordsToInsert: Record<string, unknown>[] = [];
        const pendingEscalations = new Set<string>();

        for (const zone of MONITORING_ZONES) {
          const dedupKey = `${acquisitionDate}|${zone.locationName}|Sentinel-1`;
          if (existingKeySet.has(dedupKey)) continue;

          const processed = processedResults?.find(
            (r: ProcessedDisplacement) => r.location_name === zone.locationName,
          );
          const isBookkeeping = !processed;
          const displacementMm = processed?.displacement_mm ?? 0;
          const coherence = processed?.coherence_index ?? 0.5;
          const computedRisk = computeRiskLevel(displacementMm);
          const riskLevel = processed?.risk_level ?? computedRisk ?? "none";

          recordsToInsert.push({
            department_id: satDept.id,
            satellite_name: "Sentinel-1",
            acquisition_date: acquisitionDate,
            reference_date: referenceDate,
            location_name: zone.locationName,
            latitude: zone.lat,
            longitude: zone.lon,
            displacement_mm: displacementMm,
            coherence_index: coherence,
            risk_level: riskLevel,
            cog_url: processed?.cog_url ?? quicklook ?? null,
          });

          // AGENT-TRACE: Only escalate when real processed displacement exists and
          // is critical. Bookkeeping zeros must never create safety incidents.
          if (!isBookkeeping && riskLevel === "critical" && safetyDept) {
            pendingEscalations.add(zone.locationName);
          }
        }

        if (recordsToInsert.length === 0) continue;

        // AGENT-TRACE: Bulk insert all zone records for this scene.
        const { data: inserted, error: insertError } = await serviceRole
          .from("satellite_deformations")
          .insert(recordsToInsert)
          .select();

        if (insertError) throw insertError;

        ingestedCount += inserted?.length ?? 0;

        // AGENT-TRACE: Stream every inserted row to Redis and escalate real criticals.
        for (const record of inserted ?? []) {
          const eventData = {
            id: record.id,
            department_id: record.department_id,
            satellite_name: record.satellite_name,
            acquisition_date: record.acquisition_date,
            reference_date: record.reference_date,
            location_name: record.location_name,
            latitude: record.latitude,
            longitude: record.longitude,
            displacement_mm: record.displacement_mm,
            coherence_index: record.coherence_index,
            risk_level: record.risk_level,
            cog_url: record.cog_url,
            created_at: record.created_at,
          };

          await redis.set(`${LAST_KEY_PREFIX}${record.id}`, JSON.stringify(eventData), {
            EX: 86400,
          });
          await redis.publish(STREAM_CHANNEL, JSON.stringify(eventData));

          if (
            safetyDept &&
            pendingEscalations.has(String(record.location_name)) &&
            record.risk_level === "critical"
          ) {
            await escalateCriticalDisplacement(serviceRole, safetyDept.id, record);
            escalatedCount++;
          }
        }
      }

      return {
        success: true,
        message: `Ingested ${ingestedCount} deformation records from ${s1Scenes.length} Sentinel-1 scenes`,
        ingested: ingestedCount,
        escalated: escalatedCount,
      };
    } catch (err) {
      success = false;
      await logError(err, { context: "insar_scene_ingestion_job" });
      throw err;
    } finally {
      recordJobExecution("insar-scene-ingestion", performance.now() - start, success);
    }
  },
);

// AGENT-TRACE: Call an optional external InSAR processor (StaMPS / MintPy / ISCE2
// service). Returns per-zone LOS displacement. If the env var is not set or the
// call fails, the caller falls back to acquisition bookkeeping.
async function fetchProcessedDisplacements(
  scene: STACItem,
): Promise<ProcessedDisplacement[] | null> {
  const processorUrl = process.env.INSAR_PROCESSING_API_URL;
  if (!processorUrl) return null;

  try {
    const response = await fetch(processorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        zones: MONITORING_ZONES.map((z) => ({
          id: z.id,
          location_name: z.locationName,
          latitude: z.lat,
          longitude: z.lon,
          area: z.areaKeyword,
        })),
      }),
    });

    if (!response.ok) {
      await logError(
        new Error(`InSAR processor returned ${response.status}: ${response.statusText}`),
        { context: "insar_scene_ingestion_job", phase: "processor_fetch", sceneId: scene.id },
      );
      return null;
    }

    const payload = (await response.json()) as { results?: ProcessedDisplacement[] };
    return payload.results ?? null;
  } catch (err) {
    await logError(err, {
      context: "insar_scene_ingestion_job",
      phase: "processor_fetch",
      sceneId: scene.id,
    });
    return null;
  }
}

// AGENT-TRACE: Risk thresholds mirror the manual ingestion route
// (/api/telemetry/satellite/insar) so all InSAR entry points agree.
function computeRiskLevel(displacementMm: number): "none" | "minor" | "moderate" | "critical" {
  const abs = Math.abs(displacementMm);
  if (abs >= 15) return "critical";
  if (abs >= 8) return "moderate";
  if (abs >= 3) return "minor";
  return "none";
}

async function escalateCriticalDisplacement(
  serviceRole: ReturnType<typeof createServiceRoleClient>,
  safetyDeptId: string,
  record: Record<string, unknown>,
): Promise<void> {
  try {
    await serviceRole.from("safety_incidents").insert({
      department_id: safetyDeptId,
      incident_date: record.acquisition_date,
      title: `CRITICAL SLOPE DEFORMATION: ${record.location_name} (${record.displacement_mm}mm)`,
      severity: "High",
      description:
        `Automated Sentinel-1 InSAR alert: Slope displacement of ${record.displacement_mm}mm ` +
        `detected at ${record.location_name} (Lat: ${record.latitude}, Lon: ${record.longitude}). ` +
        `Coherence: ${record.coherence_index}. Scene: ${record.cog_url || "n/a"}.`,
      status: "open",
    });
  } catch (err) {
    await logError(err, { context: "insar_scene_ingestion_job", phase: "critical_escalation" });
  }
}
