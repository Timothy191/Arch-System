import { createServiceRoleClient } from "@repo/supabase/service-role";
import { NextResponse } from "next/server";
import { logError } from "@/lib/errors/error-logger";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";
import { scannerBadgeSchema } from "@repo/contract/schemas/scanner.schema";

/**
 * @swagger
 * /api/c66:
 *   post:
 *     summary: Badge scanner validation endpoint
 *     description: Validates badge QR codes from C66 hardware scanners. Checks badge status, personnel/visitor authorization, and logs access events. Requires scanner API token authentication.
 *     tags:
 *       - Access Control
 *     security:
 *       - bearerAuth: []
 *     headers:
 *       - name: x-scanner-token
 *         required: true
 *         description: Scanner API token for authentication
 *         schema:
 *           type: string
 *       - name: x-scanner-source
 *         required: true
 *         description: Scanner source identifier
 *         schema:
 *           type: string
 *           enum: [C66-HARDWARE, C66-SCANNER, GATE-TERMINAL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Badge QR code
 *               barcode:
 *                 type: string
 *                 description: Barcode data (alternative to code)
 *               barcodeData:
 *                 type: string
 *                 description: Barcode data field (alternative to code)
 *               data:
 *                 type: string
 *                 description: Raw data field (alternative to code)
 *               qr_code:
 *                 type: string
 *                 description: QR code field (alternative to code)
 *     responses:
 *       200:
 *         description: Badge validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 name:
 *                   type: string
 *                   description: Personnel or visitor name
 *                 message:
 *                   type: string
 *                   description: Access result message
 *       400:
 *         description: Bad request - empty code payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       401:
 *         description: Unauthorized - invalid scanner token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       403:
 *         description: Forbidden - unauthorized scanner source or revoked badge
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       404:
 *         description: Badge not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 name:
 *                   type: string
 *                   example: Unrecognized Badge
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */

const ALLOWED_SCANNER_SOURCES = process.env.ALLOWED_SCANNER_SOURCES?.split(",").map((s) =>
  s.trim(),
) || ["C66-HARDWARE", "C66-SCANNER", "GATE-TERMINAL"];

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  return applyCors(request, response);
}

export async function POST(request: Request) {
  return withBodyLimit(
    request,
    async () => {
      const response = await handlePost(request);
      return applyCors(request, response);
    },
    { maxSize: 65536 },
  );
}

async function handlePost(request: Request) {
  try {
    const source = request.headers.get("x-scanner-source") || "unknown";
    const token = request.headers.get("x-scanner-token");
    const expectedToken = process.env.SCANNER_API_KEY;

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized scanner token" },
        { status: 401 },
      );
    }

    if (!ALLOWED_SCANNER_SOURCES.includes(source)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized scanner source" },
        { status: 403 },
      );
    }

    const supabase = createServiceRoleClient();

    const parsed = await validateBody(request, scannerBadgeSchema);
    if (parsed instanceof NextResponse) return parsed;

    const code = (
      parsed.data.code ||
      parsed.data.barcode ||
      parsed.data.barcodeData ||
      parsed.data.data ||
      parsed.data.qr_code ||
      ""
    ).trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Empty code payload" }, { status: 400 });
    }

    const gateLocation = parsed.data.gate_location || (parsed.data as any).gate || source;
    const direction = parsed.data.direction || "IN";
    const deviceId = parsed.data.device_id || request.headers.get("x-device-id") || null;
    const operator = parsed.data.operator || null;
    const alcoholTested = parsed.data.alcohol_tested || "Approved";

    // 1. Find the Badge by QR Code or RFID Chip UID
    const selectQuery = supabase
      .from("badges")
      .select("id, is_active, entity_type, personnel_id, visitor_id, fleet_id, equipment_id, expires_at, department_id");

    const badgeResult = typeof (selectQuery as any).or === "function"
      ? await (selectQuery as any).or(`qr_code.eq.${code},rfid_code.eq.${code}`).maybeSingle()
      : await (selectQuery as any).eq("qr_code", code).single();

    const badge = badgeResult?.data;
    const badgeError = badgeResult?.error;

    if (badgeError || !badge) {
      // Badge not found in database at all
      await logAccess(supabase, null, "UNKNOWN", "DENIED - Unrecognized Badge / RFID", gateLocation, false, null, direction, deviceId, operator, alcoholTested);
      return NextResponse.json({ success: false, name: "Unrecognized Badge / RFID" }, { status: 404 });
    }

    if (!badge.is_active) {
      // Badge revoked
      await logAccess(supabase, badge.id, badge.entity_type, "DENIED - Badge Revoked", gateLocation, false, badge.department_id, direction, deviceId, operator, alcoholTested);
      return NextResponse.json({ success: false, name: "Revoked Badge" }, { status: 403 });
    }

    if (badge.expires_at && new Date(badge.expires_at) < new Date()) {
      // Credential expired
      await logAccess(supabase, badge.id, badge.entity_type, "DENIED - Credential Expired", gateLocation, false, badge.department_id, direction, deviceId, operator, alcoholTested);
      return NextResponse.json({ success: false, name: "Expired Credential" }, { status: 403 });
    }

    // 2. Resolve the Identity across all entity types
    let entityName = "Unknown Entity";
    let isAuthorized = true;
    let denialReason: string | null = null;

    if (badge.entity_type === "personnel" && badge.personnel_id) {
      const { data: person } = await supabase
        .from("personnel")
        .select("first_name, surname, emp_code, status, induction_expiry, medical_expiry")
        .eq("id", badge.personnel_id)
        .single();
      if (person) {
        entityName = person.emp_code
          ? `${person.first_name} ${person.surname} (${person.emp_code})`
          : `${person.first_name} ${person.surname}`;
        if (person.status !== "Active") {
          isAuthorized = false;
          denialReason = `DENIED - Personnel Status: ${person.status}`;
        } else if (person.induction_expiry && new Date(person.induction_expiry) < new Date()) {
          isAuthorized = false;
          denialReason = "DENIED - Induction Expired";
        } else if (person.medical_expiry && new Date(person.medical_expiry) < new Date()) {
          isAuthorized = false;
          denialReason = "DENIED - Medical Clearance Expired";
        }
      }
    } else if (badge.entity_type === "visitor" && badge.visitor_id) {
      const { data: visitor } = await supabase
        .from("visitors")
        .select("first_name, surname, company, status")
        .eq("id", badge.visitor_id)
        .single();
      if (visitor) {
        entityName = `${visitor.first_name} ${visitor.surname} (${visitor.company || "Visitor"})`;
        if (visitor.status !== "Checked In") {
          isAuthorized = false;
          denialReason = `DENIED - Visitor Status: ${visitor.status}`;
        }
      }
    } else if ((badge.entity_type === "vehicle" || badge.entity_type === "fleet") && badge.fleet_id) {
      const { data: fleetUnit } = await supabase
        .from("fleet")
        .select("fleet_code, vehicle_type, registration_number, make, model, status")
        .eq("id", badge.fleet_id)
        .single();
      if (fleetUnit) {
        const isCoalTruck = fleetUnit.vehicle_type?.toLowerCase().includes("coal");
        const prefix = isCoalTruck ? "Coal Truck" : (fleetUnit.vehicle_type || "Vehicle");
        entityName = `${prefix}: ${fleetUnit.fleet_code} [${fleetUnit.registration_number || "No Plate"}] (${fleetUnit.make || ""} ${fleetUnit.model || ""})`.trim();
        if (fleetUnit.status !== "Active") {
          isAuthorized = false;
          denialReason = `DENIED - Vehicle Status: ${fleetUnit.status}`;
        }
      }
    } else if (badge.entity_type === "equipment" && badge.equipment_id) {
      const { data: equip } = await supabase
        .from("equipment")
        .select("equip_code, equipment_type, status, calibration_expiry")
        .eq("id", badge.equipment_id)
        .single();
      if (equip) {
        entityName = `Equipment: ${equip.equip_code} (${equip.equipment_type})`;
        if (equip.status !== "Active") {
          isAuthorized = false;
          denialReason = `DENIED - Equipment Status: ${equip.status}`;
        } else if (equip.calibration_expiry && new Date(equip.calibration_expiry) < new Date()) {
          isAuthorized = false;
          denialReason = "DENIED - Calibration Expired";
        }
      }
    }

    // 3. Log the Access Event in attendance / gate register
    await logAccess(
      supabase,
      badge.id,
      badge.entity_type,
      isAuthorized ? null : denialReason,
      gateLocation,
      isAuthorized,
      badge.department_id,
      direction,
      deviceId,
      operator,
      alcoholTested,
    );

    return NextResponse.json({
      success: isAuthorized,
      name: entityName,
      entity_type: badge.entity_type,
      message: isAuthorized ? `Access Granted - ${gateLocation}` : denialReason,
    });
  } catch (error) {
    logError(error, {
      url: "/api/c66",
      method: "POST",
    });
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

async function logAccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  badgeId: string | null,
  entityType: string,
  denialReason: string | null,
  gateLocation: string,
  accessGranted: boolean = false,
  departmentId: string | null = null,
  direction: string = "IN",
  deviceId: string | null = null,
  operator: string | null = null,
  alcoholTested: string = "Approved",
) {
  const { error } = await supabase.from("access_logs").insert([
    {
      badge_id: badgeId,
      access_type: entityType,
      direction: direction,
      gate_location: gateLocation,
      access_granted: accessGranted,
      denial_reason: denialReason,
      department_id: departmentId,
      alcohol_tested: alcoholTested,
      operator: operator,
      device_id: deviceId,
    },
  ]);

  if (error) {
    logError(new Error(error.message), {
      url: "/api/c66",
      context: "access_log_write_failed",
    });
  }
}
