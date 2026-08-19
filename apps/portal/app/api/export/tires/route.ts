/**
 * @swagger
 * /api/export/tires:
 *   get:
 *     summary: Export fleet tire inspection history and scrap logs
 *     description: Export fleet tire inspection data, wear profiles, and decommissioning/scrap logs for regulatory and maintenance audits.
 *     tags:
 *       - Export
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [fleet, inspections, scrap, all]
 *           default: all
 *         description: Type of export dataset
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: csv
 *         description: Export format
 *     responses:
 *       200:
 *         description: Export data (CSV or JSON)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { applyCors } from "@/lib/api/cors";

function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const dangerous = /^[=+\-@\t\r]/;
  const sanitized = dangerous.test(str) ? "'" + str : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

async function handleExportRequest(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return applyCors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const { searchParams } = req.nextUrl;
  const exportType = searchParams.get("type") || "all";
  const format =
    searchParams.get("format") === "json" || req.headers.get("accept")?.includes("application/json")
      ? "json"
      : "csv";

  // Fetch full tire dataset joined with machine details and inspection history
  const [{ data: tires, error: tiresErr }, { data: inspections, error: inspErr }] =
    await Promise.all([
      supabase
        .from("tires")
        .select("*, machines(name, machine_type)")
        .order("installed_at", { ascending: false }),
      supabase
        .from("tire_inspections")
        .select("*, tires(serial_number, brand, size, position, machine_id, machines(name))")
        .order("inspection_date", { ascending: false }),
    ]);

  if (tiresErr || inspErr) {
    return applyCors(
      req,
      NextResponse.json({ error: "Failed to retrieve tire audit records" }, { status: 500 }),
    );
  }

  const dateStamp = new Date().toISOString().split("T")[0];

  // 1. If format is JSON, return structured object
  if (format === "json") {
    return applyCors(
      req,
      NextResponse.json({
        exportDate: dateStamp,
        exportType,
        totalTires: tires?.length || 0,
        totalInspections: inspections?.length || 0,
        tires: tires || [],
        inspections: inspections || [],
      }),
    );
  }

  // 2. Format as CSV based on exportType
  let csvContent = "";

  if (exportType === "inspections") {
    const headers = [
      "Inspection ID",
      "Inspection Date",
      "Tire Serial",
      "Brand",
      "Size",
      "Machine Name",
      "Wheel Position",
      "Tread Depth (mm)",
      "Pressure (PSI)",
      "Condition Status",
      "Inspector Notes",
    ];

    const rows = (inspections || []).map((insp: any) => [
      sanitizeCsvCell(insp.id),
      sanitizeCsvCell(insp.inspection_date),
      sanitizeCsvCell(insp.tires?.serial_number || "—"),
      sanitizeCsvCell(insp.tires?.brand || "—"),
      sanitizeCsvCell(insp.tires?.size || "—"),
      sanitizeCsvCell(insp.tires?.machines?.name || "Unassigned"),
      sanitizeCsvCell(insp.tires?.position || "—"),
      sanitizeCsvCell(insp.tread_depth_mm),
      sanitizeCsvCell(insp.pressure_psi),
      sanitizeCsvCell(insp.condition_status),
      sanitizeCsvCell(insp.notes || ""),
    ]);

    csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  } else if (exportType === "scrap") {
    const headers = [
      "Tire ID",
      "Serial Number",
      "Brand",
      "Size",
      "Machine",
      "Wheel Position",
      "Installed Date",
      "Installed Hours",
      "Decommission Date",
      "Final Machine Hours",
      "Total Operating Hours",
      "Scrap / Failure Reason",
    ];

    const scrappedTires = (tires || []).filter((t: any) => t.status === "scrapped");
    const rows = scrappedTires.map((t: any) => [
      sanitizeCsvCell(t.id),
      sanitizeCsvCell(t.serial_number),
      sanitizeCsvCell(t.brand),
      sanitizeCsvCell(t.size),
      sanitizeCsvCell(t.machines?.name || "Unassigned"),
      sanitizeCsvCell(t.position),
      sanitizeCsvCell(t.installed_at),
      sanitizeCsvCell(t.installed_hours),
      sanitizeCsvCell(t.removed_at || "—"),
      sanitizeCsvCell(t.removed_hours || "—"),
      sanitizeCsvCell(
        t.removed_hours !== null && t.installed_hours !== null
          ? t.removed_hours - t.installed_hours
          : "—",
      ),
      sanitizeCsvCell(t.scrapped_reason || "Unspecified"),
    ]);

    csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  } else {
    // Combined / Full Audit Log
    const headers = [
      "Tire ID",
      "Serial Number",
      "Brand",
      "Size",
      "Machine",
      "Wheel Position",
      "Status",
      "Installed Date",
      "Operating Hours",
      "Decommission Date",
      "Scrap Reason",
      "Created At",
    ];

    const rows = (tires || []).map((t: any) => [
      sanitizeCsvCell(t.id),
      sanitizeCsvCell(t.serial_number),
      sanitizeCsvCell(t.brand),
      sanitizeCsvCell(t.size),
      sanitizeCsvCell(t.machines?.name || "Unassigned"),
      sanitizeCsvCell(t.position),
      sanitizeCsvCell(t.status),
      sanitizeCsvCell(t.installed_at),
      sanitizeCsvCell(t.installed_hours),
      sanitizeCsvCell(t.removed_at || ""),
      sanitizeCsvCell(t.scrapped_reason || ""),
      sanitizeCsvCell(t.created_at),
    ]);

    csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tire-audit-${exportType}-${dateStamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, () => handleExportRequest(req));
}
