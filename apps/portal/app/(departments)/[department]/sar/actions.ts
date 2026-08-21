"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@repo/supabase/server";
import {
  insarGeoTIFFUploadSchema,
  type InsarGeoTIFFUploadInput,
} from "@repo/contract/schemas/satellite.schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// AGENT-TRACE: Server Action to validate and ingest InSAR GeoTIFF satellite metadata
export async function ingestInSARGeoTIFFAction(
  rawInput: InsarGeoTIFFUploadInput,
): Promise<ActionResult> {
  try {
    const parseResult = insarGeoTIFFUploadSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        ? parseResult.error.issues.map((e: { message: string }) => e.message).join(", ")
        : parseResult.error.message || "Invalid payload";
      return { success: false, error: `Validation error: ${errorMsg}` };
    }

    const payload = parseResult.data;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized access" };
    }

    const absDisp = Math.abs(payload.max_displacement_mm);
    const risk_level: "none" | "minor" | "moderate" | "critical" =
      absDisp >= 15.0
        ? "critical"
        : absDisp >= 8.0
          ? "moderate"
          : absDisp >= 3.0
            ? "minor"
            : "none";

    const insertData = {
      department_id: payload.department_id,
      satellite_name: payload.satellite_name,
      acquisition_date: payload.acquisition_date,
      reference_date: payload.reference_date,
      location_name: payload.location_name,
      latitude: (payload.min_lat + payload.max_lat) / 2,
      longitude: (payload.min_lon + payload.max_lon) / 2,
      displacement_mm: payload.max_displacement_mm,
      coherence_index: payload.coherence_threshold,
      risk_level,
      cog_url: payload.cog_url || null,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from("satellite_deformations")
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message || "Failed to insert satellite deformation" };
    }

    // Auto-trigger Safety Incident for critical slope movement (>= 15mm/mo)
    if (risk_level === "critical") {
      try {
        const { data: safetyDept } = await supabase
          .from("departments")
          .select("id")
          .eq("name", "safety")
          .maybeSingle();

        if (safetyDept) {
          await supabase.from("safety_incidents").insert({
            department_id: safetyDept.id,
            incident_date: payload.acquisition_date,
            title: `CRITICAL SLOPE DEFORMATION: ${payload.location_name} (${payload.max_displacement_mm}mm)`,
            severity: "High",
            description: `Automated ${payload.satellite_name} InSAR alert: Max displacement of ${payload.max_displacement_mm}mm detected.`,
            status: "open",
          });
        }
      } catch {
        // Non-blocking escalation
      }
    }

    revalidatePath("/satellite-monitoring/sar");
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Unexpected server error during InSAR ingestion",
    };
  }
}

// AGENT-TRACE: Server Action to fetch InSAR spatial deformation points for SAR dashboard
export async function getDeformationPointsAction({
  departmentId,
  locationName,
}: {
  departmentId: string;
  locationName?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    let query = supabase
      .from("satellite_deformations")
      .select("*")
      .eq("department_id", departmentId)
      .order("acquisition_date", { ascending: false });

    if (locationName) {
      query = query.eq("location_name", locationName);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch deformation points" };
  }
}
