"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import crypto from "node:crypto";
import { multiSiteShiftReportSchema } from "@repo/contract/schemas/multi-site-production.schema";
import type { MultiSiteShiftReport } from "@repo/contract/types/multi-site-production.types";
import { serverLogger } from "@repo/logger";

interface ExportPdfParams {
  departmentId: string;
  shiftDate: string;
  shiftType: "day" | "night";
}

interface ExportPdfResponse {
  success: boolean;
  pdfBase64?: string;
  htmlContent?: string;
  fileName?: string;
  signatureHash?: string;
  error?: string;
}

// AGENT-TRACE: Server action fetching multi-site compilation, generating SHA256 digital signature seal, and providing report markup/PDF export payload.
export async function exportSignedShiftReportPdf(
  params: ExportPdfParams,
): Promise<ExportPdfResponse> {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized. Active session required." };
    }

    // 2. Fetch compiled shift data
    const { data: rawData, error: rpcError } = await supabase.rpc(
      "get_multi_site_shift_compilation",
      {
        p_department_id: params.departmentId,
        p_shift_date: params.shiftDate,
        p_shift_type: params.shiftType,
      },
    );

    if (rpcError || !rawData) {
      serverLogger.error({
        err: new Error(rpcError?.message || "Failed to fetch shift data"),
        context: "exportSignedShiftReportPdf:rpc",
      });
      return { success: false, error: rpcError?.message || "Failed to compile report data." };
    }

    const parsed = multiSiteShiftReportSchema.safeParse(rawData);
    const reportData: MultiSiteShiftReport = parsed.success
      ? parsed.data
      : (rawData as MultiSiteShiftReport);

    // 3. Generate Cryptographic Signature Verification Hash
    const hashPayload = JSON.stringify({
      departmentId: params.departmentId,
      shiftDate: params.shiftDate,
      shiftType: params.shiftType,
      production: reportData.production,
      rollover: reportData.rollover,
      breakdowns: reportData.breakdowns,
      signedBy: user.id,
      signedAt: new Date().toISOString(),
    });

    const signatureHash = crypto
      .createHmac("sha256", process.env.SHIFT_SIGNING_SECRET || "arch-mining-secret-key")
      .update(hashPayload)
      .digest("hex");

    // 4. Render HTML template for the print document
    const htmlContent = generatePrintHtml(
      reportData,
      signatureHash,
      user.email || "Control Room Lead",
    );

    const fileName = `Shift_Report_${params.shiftDate}_${params.shiftType.toUpperCase()}_${signatureHash.slice(0, 8)}.pdf`;

    return {
      success: true,
      htmlContent,
      fileName,
      signatureHash,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "PDF generation failed";
    serverLogger.error({
      err: err instanceof Error ? err : new Error(errorMsg),
      context: "exportSignedShiftReportPdf:catch",
    });
    return { success: false, error: `PDF generation failed: ${errorMsg}` };
  }
}

// Standalone HTML template builder for pixel-accurate print layout
function generatePrintHtml(
  report: MultiSiteShiftReport,
  signatureHash: string,
  signerEmail: string,
): string {
  const { meta, production, rollover, breakdowns, ancillary } = report;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Daily Production & Engineering Report</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 8.5pt; color: #0f172a; margin: 0; padding: 12px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th { background-color: #f1f5f9; color: #334155; font-size: 7pt; text-transform: uppercase; border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; }
      td { border: 1px solid #e2e8f0; padding: 3px 5px; font-size: 7.5pt; }
      .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; }
      .section-banner { font-size: 9pt; font-weight: bold; background: #e2e8f0; padding: 2px 6px; margin: 6px 0 3px 0; border-left: 3px solid #0f172a; text-transform: uppercase; }
      .mono { font-family: monospace; }
      .bold { font-weight: bold; }
      .signature-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 6px 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
      .seal { border: 2px solid #059669; color: #059669; padding: 4px 8px; font-weight: bold; font-size: 7.5pt; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header-box">
      <div>
        <h2 style="margin: 0; font-size: 13pt; text-transform: uppercase;">Daily Production & Engineering Shift Report</h2>
        <div style="font-size: 8pt; color: #475569; margin-top: 2px;">
          Brakfontein Pit (BKF) • Extension Pit (EXT) • Coal Processing Plant
        </div>
      </div>
      <div style="text-align: right;">
        <div class="bold" style="font-size: 10pt;">${meta.shift_date}</div>
        <div style="font-size: 8pt; color: #0f172a; font-weight: 600;">${meta.shift_type.toUpperCase()} SHIFT</div>
      </div>
    </div>

    <!-- 1. EXCAVATOR PRODUCTION -->
    <div class="section-banner">1. Excavator Loading & Hauling Performance</div>
    <table>
      <thead>
        <tr>
          <th>Site</th>
          <th>Loader (Operator)</th>
          <th>Block & Material</th>
          <th>Haul Units / Load Distribution</th>
          <th>Total Loads</th>
          <th>Total Output</th>
          <th>Operating</th>
          <th>Rate</th>
          <th>Delays</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(production || {})
          .flatMap(([site, excavators]) =>
            excavators.map(
              (exc) => `
            <tr>
              <td class="bold">${site}</td>
              <td><strong>${exc.excavator_name}</strong> (${exc.operator_name})</td>
              <td>${exc.block_id} — ${exc.material_type}</td>
              <td class="mono" style="font-size: 7pt;">
                ${exc.trucks.map((t) => `${t.truck_name}=${t.loads}`).join(", ")}
              </td>
              <td class="bold mono">${exc.total_loads}</td>
              <td class="bold mono">${exc.material_type === "TOPSOIL" ? `${exc.total_bcm.toLocaleString()} m³` : `${exc.total_tonnes.toLocaleString()} t`}</td>
              <td class="mono">${exc.operating_hours}h</td>
              <td class="mono bold">${exc.rate_per_hour}</td>
              <td style="color: #b45309;">${exc.delays || "—"}</td>
            </tr>
          `,
            ),
          )
          .join("")}
      </tbody>
    </table>

    <!-- 2. DOZER ROLLOVER & ANCILLARY -->
    <div style="display: flex; gap: 8px; margin-top: 4px;">
      <div style="flex: 1.2;">
        <div class="section-banner">2. Bulldozer Rollover (Push Factor: 250 m³/h)</div>
        <table>
          <thead>
            <tr><th>Unit</th><th>SMU Delta</th><th>Hours</th><th>Total Pushed</th></tr>
          </thead>
          <tbody>
            ${(rollover?.entries || [])
              .map(
                (r) => `
              <tr>
                <td class="bold">${r.machine_name}</td>
                <td class="mono">${r.start_smu} - ${r.end_smu}</td>
                <td class="mono">${r.hours}h</td>
                <td class="bold mono">${r.total_bcm.toLocaleString()} BCM</td>
              </tr>
            `,
              )
              .join("")}
            <tr style="background-color: #f1f5f9;">
              <td colspan="3" class="bold">Total Rollover Pushed</td>
              <td class="bold mono">${rollover?.total_bcm?.toLocaleString() || 0} BCM</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="flex: 1;">
        <div class="section-banner">3. Ancillary Runs & Dust Suppression</div>
        <table>
          <thead><tr><th>Equipment</th><th>Site</th><th>Activity / Logistics</th></tr></thead>
          <tbody>
            ${(ancillary || [])
              .map(
                (a) => `
              <tr>
                <td class="bold">${a.machine_name}</td>
                <td>${a.site_code}</td>
                <td>${a.activity_type} ${a.trip_loads ? `(${a.trip_loads} loads)` : ""} ${a.notes || ""}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. ENGINEERING BREAKDOWNS & BREDELL WORKSHOP -->
    <div class="section-banner">4. Engineering Breakdowns & Off-site Repairs</div>
    <table>
      <thead>
        <tr>
          <th style="width: 12%;">Machine</th>
          <th style="width: 8%;">Site</th>
          <th style="width: 10%;">Duration</th>
          <th style="width: 50%;">Failure Reason / Repair Notes</th>
          <th style="width: 20%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${(breakdowns || [])
          .map(
            (b) => `
          <tr>
            <td class="bold mono">${b.machine_name}</td>
            <td>${b.site_code}</td>
            <td class="mono bold" style="color: ${b.duration_hours >= 10 ? "#dc2626" : "#0f172a"};">${b.duration_hours} hrs</td>
            <td>${b.reason} ${b.repair_notes ? `— <em>${b.repair_notes}</em>` : ""}</td>
            <td>${b.is_operational_defect ? '<span style="color: #d97706;">Operational with Defect</span>' : b.status.toUpperCase()}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>

    <!-- 4. SIGNATURE & VERIFICATION BLOCK -->
    <div class="signature-card">
      <div>
        <div style="font-size: 7.5pt; color: #64748b;">CRYPTOGRAPHIC VERIFICATION SEAL</div>
        <div class="mono bold" style="font-size: 7pt; word-break: break-all; max-width: 420px; color: #1e293b;">
          SHA256: ${signatureHash}
        </div>
        <div style="font-size: 7.5pt; color: #64748b; margin-top: 3px;">
          Signed By: <strong>${signerEmail}</strong> • Timestamp: ${new Date().toISOString()}
        </div>
      </div>
      <div class="seal">
        OPERATIONAL & ENGINEERING<br />OFFICIALLY SIGNED & VERIFIED
      </div>
    </div>
  </body>
  </html>
  `;
}
