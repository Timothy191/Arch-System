"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { AuthError, DatabaseError, ForbiddenError } from "@/lib/errors/error-classes";

export type CredentialEntityType = "personnel" | "vehicle" | "coal_truck" | "visitor" | "equipment";

export interface BadgeInventoryItem {
  id: string;
  qr_code: string;
  rfid_code: string | null;
  entity_type: string;
  is_active: boolean;
  issued_at: string;
  expires_at: string | null;
  entity_name: string;
  entity_subtitle: string;
  entity_id: string | null;
  status: string;
}

export interface EntityOption {
  id: string;
  label: string;
  sublabel: string;
  type: CredentialEntityType;
}

async function assertAccessControlRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("Unauthorized");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role, department_id")
    .eq("auth_id", user.id)
    .single();

  if (!employee || !["admin", "access_control"].includes(employee.role)) {
    throw new ForbiddenError("Forbidden: access_control or admin role required", {
      resource: "qr_management",
      action: "assert_role",
    });
  }

  return { supabase, user, employee };
}

/**
 * Get all badges inventory joined with their specific entity details
 */
export async function getBadgesInventory(
  filterType?: string,
  search?: string,
): Promise<BadgeInventoryItem[]> {
  const { supabase } = await assertAccessControlRole();

  let query = supabase
    .from("badges")
    .select(
      `
      id,
      qr_code,
      rfid_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel_id,
      visitor_id,
      fleet_id,
      equipment_id,
      personnel:personnel_id(id, first_name, surname, emp_code, status, job_title),
      visitor:visitor_id(id, first_name, surname, company, status),
      fleet:fleet_id(id, fleet_code, vehicle_type, registration_number, make, model, status),
      equipment:equipment_id(id, equip_code, equipment_type, status)
    `,
    )
    .order("issued_at", { ascending: false })
    .limit(100);

  if (filterType && filterType !== "all") {
    if (filterType === "coal_truck") {
      query = query.in("entity_type", ["vehicle", "fleet"]);
    } else if (filterType === "vehicle") {
      query = query.in("entity_type", ["vehicle", "fleet"]);
    } else {
      query = query.eq("entity_type", filterType);
    }
  }

  if (search && search.trim().length > 0) {
    const s = search.trim();
    query = query.or(`qr_code.ilike.%${s}%,rfid_code.ilike.%${s}%`);
  }

  const { data: badges, error } = await query;

  if (error) {
    throw new DatabaseError("Failed to load badges inventory", {
      table: "badges",
      cause: error,
    });
  }

  const results: BadgeInventoryItem[] = (badges ?? []).map((b) => {
    let entityName = "Unassigned Credential";
    let entitySubtitle = "Unknown Target";
    let entityId: string | null = null;
    let status = b.is_active ? "Active" : "Revoked";

    const p = b.personnel as unknown as {
      id: string;
      first_name: string;
      surname: string;
      emp_code: string;
      status: string;
      job_title?: string;
    } | null;

    const v = b.visitor as unknown as {
      id: string;
      first_name: string;
      surname: string;
      company?: string;
      status: string;
    } | null;

    const f = b.fleet as unknown as {
      id: string;
      fleet_code: string;
      vehicle_type: string;
      registration_number?: string;
      make?: string;
      model?: string;
      status: string;
    } | null;

    const eq = b.equipment as unknown as {
      id: string;
      equip_code: string;
      equipment_type: string;
      status: string;
    } | null;

    if (p) {
      entityName = `${p.first_name} ${p.surname}`;
      entitySubtitle = `${p.emp_code} • ${p.job_title || "Employee"}`;
      entityId = p.id;
      if (p.status !== "Active") status = `Personnel ${p.status}`;
    } else if (v) {
      entityName = `${v.first_name} ${v.surname}`;
      entitySubtitle = `Visitor • ${v.company || "General Visitor"}`;
      entityId = v.id;
      if (v.status !== "Checked In") status = `Visitor ${v.status}`;
    } else if (f) {
      const isCoal = f.vehicle_type?.toLowerCase().includes("coal");
      entityName = `${f.fleet_code} (${f.make || ""} ${f.model || ""})`.trim();
      entitySubtitle = `${f.vehicle_type} • Reg: ${f.registration_number || "No Plate"}`;
      entityId = f.id;
      if (f.status !== "Active") status = `Fleet ${f.status}`;
      if (isCoal) {
        entitySubtitle = `Coal Truck • Reg: ${f.registration_number || "No Plate"}`;
      }
    } else if (eq) {
      entityName = eq.equip_code;
      entitySubtitle = `${eq.equipment_type} • Machinery`;
      entityId = eq.id;
      if (eq.status !== "Active") status = `Equipment ${eq.status}`;
    }

    return {
      id: b.id,
      qr_code: b.qr_code,
      rfid_code: b.rfid_code,
      entity_type: b.entity_type,
      is_active: b.is_active,
      issued_at: b.issued_at,
      expires_at: b.expires_at,
      entity_name: entityName,
      entity_subtitle: entitySubtitle,
      entity_id: entityId,
      status,
    };
  });

  if (filterType === "coal_truck") {
    return results.filter((r) => r.entity_subtitle.toLowerCase().includes("coal"));
  }

  return results;
}

/**
 * Get available entity options for selector dropdowns
 */
export async function getEntityOptions(): Promise<{
  personnel: EntityOption[];
  vehicles: EntityOption[];
  coalTrucks: EntityOption[];
  visitors: EntityOption[];
  equipment: EntityOption[];
}> {
  const { supabase } = await assertAccessControlRole();

  const [pRes, fRes, vRes, eqRes] = await Promise.all([
    supabase
      .from("personnel")
      .select("id, first_name, surname, emp_code, job_title")
      .eq("status", "Active")
      .limit(50),
    supabase
      .from("fleet")
      .select("id, fleet_code, vehicle_type, registration_number, make, model")
      .eq("status", "Active")
      .limit(50),
    supabase
      .from("visitors")
      .select("id, first_name, surname, company")
      .eq("status", "Checked In")
      .limit(50),
    supabase
      .from("equipment")
      .select("id, equip_code, equipment_type")
      .eq("status", "Active")
      .limit(50),
  ]);

  const personnel: EntityOption[] = (pRes.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.first_name} ${p.surname} (${p.emp_code})`,
    sublabel: p.job_title || "Employee",
    type: "personnel",
  }));

  const allVehicles = fRes.data ?? [];
  const coalTrucks: EntityOption[] = allVehicles
    .filter((v) => v.vehicle_type?.toLowerCase().includes("coal"))
    .map((v) => ({
      id: v.id,
      label: `${v.fleet_code} - ${v.make || ""} ${v.model || ""}`.trim(),
      sublabel: `Coal Truck • Reg: ${v.registration_number || "N/A"}`,
      type: "coal_truck",
    }));

  const vehicles: EntityOption[] = allVehicles
    .filter((v) => !v.vehicle_type?.toLowerCase().includes("coal"))
    .map((v) => ({
      id: v.id,
      label: `${v.fleet_code} - ${v.make || ""} ${v.model || ""}`.trim(),
      sublabel: `${v.vehicle_type} • Reg: ${v.registration_number || "N/A"}`,
      type: "vehicle",
    }));

  const visitors: EntityOption[] = (vRes.data ?? []).map((v) => ({
    id: v.id,
    label: `${v.first_name} ${v.surname}`,
    sublabel: v.company || "Visitor",
    type: "visitor",
  }));

  const equipment: EntityOption[] = (eqRes.data ?? []).map((eq) => ({
    id: eq.id,
    label: eq.equip_code,
    sublabel: eq.equipment_type,
    type: "equipment",
  }));

  return { personnel, vehicles, coalTrucks, visitors, equipment };
}

export interface CreateBadgePayload {
  entityType: CredentialEntityType;
  code?: string;
  rfidCode?: string;
  targetEntityId?: string;
  newEntityData?: {
    name?: string;
    code?: string;
    regNumber?: string;
    make?: string;
    model?: string;
    company?: string;
    reason?: string;
  };
  expiresInDays?: number;
}

/**
 * Create and register a new QR/RFID badge credential for any entity type
 */
export async function createBadgeCredential(payload: CreateBadgePayload) {
  const { supabase, employee } = await assertAccessControlRole();

  let entityId = payload.targetEntityId ?? null;
  const entityType = payload.entityType;

  // 1. Handle on-the-fly entity creation if needed
  if (!entityId && payload.newEntityData) {
    const d = payload.newEntityData;
    if (entityType === "coal_truck") {
      const fleetCode = d.code || `CT-${Math.floor(10 + Math.random() * 90)}`;
      const { data: fleetRec, error: fErr } = await supabase
        .from("fleet")
        .insert({
          fleet_code: fleetCode,
          vehicle_type: "Coal Truck",
          registration_number: d.regNumber || "REG-COAL",
          make: d.make || "Scania",
          model: d.model || "R500 6x4",
          department_id: employee.department_id,
          status: "Active",
        })
        .select()
        .single();
      if (fErr)
        throw new DatabaseError("Failed to create Coal Truck", { table: "fleet", cause: fErr });
      entityId = fleetRec.id;
    } else if (entityType === "vehicle") {
      const fleetCode = d.code || `VEH-${Math.floor(100 + Math.random() * 900)}`;
      const { data: fleetRec, error: fErr } = await supabase
        .from("fleet")
        .insert({
          fleet_code: fleetCode,
          vehicle_type: "Light Vehicle",
          registration_number: d.regNumber || "REG-VEH",
          make: d.make || "Toyota",
          model: d.model || "Hilux",
          department_id: employee.department_id,
          status: "Active",
        })
        .select()
        .single();
      if (fErr)
        throw new DatabaseError("Failed to create vehicle", { table: "fleet", cause: fErr });
      entityId = fleetRec.id;
    } else if (entityType === "visitor") {
      const [fName, ...sNames] = (d.name || "Guest Visitor").split(" ");
      const { data: visRec, error: vErr } = await supabase
        .from("visitors")
        .insert({
          first_name: fName || "Guest",
          surname: sNames.join(" ") || "Visitor",
          company: d.company || "Contractor",
          reason_for_entry: d.reason || "Site Visit",
          department_id: employee.department_id,
          status: "Checked In",
        })
        .select()
        .single();
      if (vErr)
        throw new DatabaseError("Failed to create visitor", { table: "visitors", cause: vErr });
      entityId = visRec.id;
    } else if (entityType === "equipment") {
      const eqCode = d.code || `EQP-${Math.floor(100 + Math.random() * 900)}`;
      const { data: eqRec, error: eqErr } = await supabase
        .from("equipment")
        .insert({
          equip_code: eqCode,
          equipment_type: d.model || "Heavy Machinery",
          department_id: employee.department_id,
          status: "Active",
        })
        .select()
        .single();
      if (eqErr)
        throw new DatabaseError("Failed to create equipment", { table: "equipment", cause: eqErr });
      entityId = eqRec.id;
    }
  }

  // 2. Generate or format QR code
  let qrCode = payload.code?.trim();
  if (!qrCode) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    switch (entityType) {
      case "coal_truck":
        qrCode = `TRK-COAL-${randomSuffix}`;
        break;
      case "vehicle":
        qrCode = `VEH-${randomSuffix}`;
        break;
      case "visitor":
        qrCode = `VIS-${randomSuffix}`;
        break;
      case "equipment":
        qrCode = `EQP-${randomSuffix}`;
        break;
      default:
        qrCode = `EMP-${randomSuffix}`;
        break;
    }
  }

  // 3. Compute Expiry
  let expiresAt: string | null = null;
  if (payload.expiresInDays && payload.expiresInDays > 0) {
    expiresAt = new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (entityType === "visitor") {
    // Visitors default to 24-hour pass
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // 4. Map to database entity_type
  const dbEntityType =
    entityType === "coal_truck" || entityType === "vehicle"
      ? "vehicle"
      : entityType === "equipment"
        ? "equipment"
        : entityType === "visitor"
          ? "visitor"
          : "personnel";

  // 5. Insert Badge
  const insertPayload: Record<string, unknown> = {
    qr_code: qrCode,
    rfid_code: payload.rfidCode?.trim() || null,
    entity_type: dbEntityType,
    department_id: employee.department_id,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
  };

  if (dbEntityType === "personnel") insertPayload.personnel_id = entityId;
  else if (dbEntityType === "visitor") insertPayload.visitor_id = entityId;
  else if (dbEntityType === "vehicle") insertPayload.fleet_id = entityId;
  else if (dbEntityType === "equipment") insertPayload.equipment_id = entityId;

  const { data: newBadge, error } = await supabase
    .from("badges")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw new DatabaseError("Failed to save badge to database", {
      table: "badges",
      cause: error,
    });
  }

  revalidatePath("/access-control/qr-codes");
  return { success: true, badge: newBadge };
}

/**
 * Revoke a badge
 */
export async function revokeBadgeCredential(badgeId: string) {
  const { supabase } = await assertAccessControlRole();

  const { error } = await supabase
    .from("badges")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", badgeId);

  if (error) {
    throw new DatabaseError("Failed to revoke badge", { table: "badges", cause: error });
  }

  revalidatePath("/access-control/qr-codes");
  return { success: true };
}
