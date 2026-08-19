import { getDepartmentContext } from "~/lib/dept-context";
import { TireManagementDashboard } from "@/features/departments";
import type { TireWithInspections } from "@/features/departments";
import { createReadReplicaClient } from "@repo/supabase/read-replica";

export const dynamic = "force-dynamic";

export default async function TireManagementPage() {
  await getDepartmentContext({
    department: "engineering",
  });

  const db = await createReadReplicaClient();

  // Fetch tires with machine names and inspection logs
  const [{ data: tiresData }, { data: machinesData }, { data: inspectionsData }] =
    await Promise.all([
      db
        .from("tires")
        .select("*, machines(name, machine_type)")
        .order("created_at", { ascending: false }),
      db
        .from("machines")
        .select("id, name, machine_type, serial_number")
        .eq("active", true)
        .order("name"),
      db
        .from("tire_inspections")
        .select(
          "id, tire_id, inspection_date, tread_depth_mm, pressure_psi, condition_status, notes, created_at",
        )
        .order("inspection_date", { ascending: true }),
    ]);

  // Group inspections by tire_id
  const inspectionsByTire = new Map<string, any[]>();
  for (const insp of inspectionsData || []) {
    const list = inspectionsByTire.get(insp.tire_id) || [];
    list.push(insp);
    inspectionsByTire.set(insp.tire_id, list);
  }

  // Format tires with latest inspection and history
  const tires: TireWithInspections[] = (tiresData || []).map((t: any) => {
    const inspections = inspectionsByTire.get(t.id) || [];
    const latestInspection = inspections.length > 0 ? inspections[inspections.length - 1] : null;

    return {
      id: t.id,
      serial_number: t.serial_number,
      brand: t.brand,
      size: t.size,
      machine_id: t.machine_id,
      machine_name: t.machines?.name || null,
      position: t.position,
      status: t.status,
      installed_at: t.installed_at,
      installed_hours: t.installed_hours || 0,
      removed_at: t.removed_at || null,
      removed_hours: t.removed_hours || null,
      scrapped_reason: t.scrapped_reason || null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      inspections,
      latest_inspection: latestInspection
        ? {
            tread_depth_mm: Number(latestInspection.tread_depth_mm),
            pressure_psi: Number(latestInspection.pressure_psi),
            condition_status: latestInspection.condition_status,
            inspection_date: latestInspection.inspection_date,
            notes: latestInspection.notes,
          }
        : null,
    };
  });

  const machines = (machinesData || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    serial_number: m.serial_number,
    machine_type: m.machine_type,
  }));

  return <TireManagementDashboard tires={tires} machines={machines} />;
}
