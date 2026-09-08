"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { AuthError, DatabaseError, ForbiddenError } from "@/lib/errors/error-classes";

export interface Neo300Printer {
  id: string;
  name: string;
  model: string;
  cups_name: string;
  connection_type: string;
  status: string;
  status_message: string | null;
  last_online_at: string | null;
}

export interface EmployeeCardProfile {
  id: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string | null;
  department_id: string | null;
  department_name?: string;
  induction_expiry: string | null;
  medical_expiry: string | null;
  status: string;
  qr_code: string | null;
  rfid_code: string | null;
  has_card: boolean;
  photo_url?: string | null;
}

export interface CardPrintJob {
  id: string;
  personnel_id: string | null;
  employee_name: string;
  role_title: string | null;
  qr_code_data: string | null;
  status: string;
  created_at: string;
  printer_id: string | null;
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
      resource: "neo300_print",
      action: "assert_role",
    });
  }

  return { supabase, user, employee };
}

/**
 * Get or register the Magicard Neo 300 card printer
 */
export async function getNeo300PrinterStatus(): Promise<Neo300Printer> {
  const { supabase } = await assertAccessControlRole();

  let { data: printer } = await supabase
    .from("card_printers")
    .select("*")
    .ilike("model", "%Neo%300%")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!printer) {
    // Check by cups_name
    const { data: byName } = await supabase
      .from("card_printers")
      .select("*")
      .ilike("cups_name", "%Neo%")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    printer = byName;
  }

  if (!printer) {
    // Auto-register default Neo 300 printer
    const { data: inserted, error } = await supabase
      .from("card_printers")
      .insert({
        cups_name: "Magicard_Neo300",
        name: "Security Gate Neo300 Card Printer",
        model: "Neo Magic 300",
        connection_type: "usb",
        status: "online",
        status_message: "Ready to print ID cards",
        last_online_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError("Failed to register Neo 300 printer", {
        table: "card_printers",
        cause: error,
      });
    }
    printer = inserted;
  }

  return printer as Neo300Printer;
}

/**
 * Search and retrieve employees for badge printing
 */
export async function getEmployeeCardProfiles(search?: string): Promise<EmployeeCardProfile[]> {
  const { supabase } = await assertAccessControlRole();

  let query = supabase
    .from("personnel")
    .select(`
      id,
      emp_code,
      first_name,
      surname,
      id_number,
      job_title,
      department_id,
      induction_expiry,
      medical_expiry,
      status,
      departments:department_id(display_name)
    `)
    .order("surname", { ascending: true })
    .limit(100);

  if (search && search.trim().length > 0) {
    const s = search.trim();
    query = query.or(
      `first_name.ilike.%${s}%,surname.ilike.%${s}%,emp_code.ilike.%${s}%,id_number.ilike.%${s}%`
    );
  }

  const { data: personnelList, error } = await query;

  if (error) {
    throw new DatabaseError("Failed to load personnel for card printing", {
      table: "personnel",
      cause: error,
    });
  }

  if (!personnelList || personnelList.length === 0) {
    return [];
  }

  const personnelIds = personnelList.map((p) => p.id);

  // Fetch active badges
  const { data: badges } = await supabase
    .from("badges")
    .select("personnel_id, qr_code, rfid_code, is_active")
    .in("personnel_id", personnelIds)
    .eq("is_active", true);

  const badgeMap = new Map<string, { qr_code: string; rfid_code: string | null }>();
  (badges ?? []).forEach((b) => {
    if (b.personnel_id) {
      badgeMap.set(b.personnel_id, { qr_code: b.qr_code, rfid_code: b.rfid_code });
    }
  });

  return personnelList.map((p) => {
    const badge = badgeMap.get(p.id);
    const deptRecord = p.departments as unknown as { display_name: string } | null;
    return {
      id: p.id,
      emp_code: p.emp_code,
      first_name: p.first_name,
      surname: p.surname,
      id_number: p.id_number,
      job_title: p.job_title,
      department_id: p.department_id,
      department_name: deptRecord?.display_name ?? "General Operations",
      induction_expiry: p.induction_expiry,
      medical_expiry: p.medical_expiry,
      status: p.status,
      qr_code: badge?.qr_code ?? null,
      rfid_code: badge?.rfid_code ?? null,
      has_card: !!badge,
    };
  });
}

/**
 * Send an employee card print job to the Magicard Neo 300
 */
export async function sendNeo300PrintJob(personnelId: string) {
  const { supabase, employee } = await assertAccessControlRole();

  const { data: person } = await supabase
    .from("personnel")
    .select("id, first_name, surname, job_title, emp_code, induction_expiry")
    .eq("id", personnelId)
    .single();

  if (!person) {
    throw new DatabaseError("Personnel not found", { table: "personnel" });
  }

  // Check or create badge if missing
  let { data: badge } = await supabase
    .from("badges")
    .select("id, qr_code, rfid_code")
    .eq("personnel_id", personnelId)
    .eq("is_active", true)
    .maybeSingle();

  if (!badge) {
    const generatedQr = `EMP-${person.emp_code || person.id.substring(0, 8).toUpperCase()}`;
    const { data: newBadge, error: bError } = await supabase
      .from("badges")
      .insert({
        qr_code: generatedQr,
        entity_type: "personnel",
        personnel_id: personnelId,
        department_id: employee.department_id,
        is_active: true,
      })
      .select()
      .single();

    if (bError) {
      throw new DatabaseError("Failed to issue badge for printing", {
        table: "badges",
        cause: bError,
      });
    }
    badge = newBadge;
  }

  const printer = await getNeo300PrinterStatus();

  // Create print job
  const { data: job, error: jobError } = await supabase
    .from("print_jobs")
    .insert({
      personnel_id: person.id,
      employee_name: `${person.first_name} ${person.surname}`,
      role_title: person.job_title,
      qr_code_data: badge?.qr_code,
      status: "queued",
      printer_id: printer.id,
      created_by: employee.id,
      expires_at: person.induction_expiry ?? undefined,
    })
    .select()
    .single();

  if (jobError) {
    throw new DatabaseError("Failed to dispatch print job to Neo 300", {
      table: "print_jobs",
      cause: jobError,
    });
  }

  // Update card_printers status to active
  await supabase
    .from("card_printers")
    .update({
      status: "online",
      last_online_at: new Date().toISOString(),
      status_message: `Printing job #${job.id.substring(0, 8)} for ${person.first_name} ${person.surname}`,
    })
    .eq("id", printer.id);

  revalidatePath("/access-control/print-cards");
  return { success: true, job };
}

/**
 * Get recent card print jobs
 */
export async function getRecentNeo300Jobs(limit = 10): Promise<CardPrintJob[]> {
  const { supabase } = await assertAccessControlRole();

  const { data: jobs, error } = await supabase
    .from("print_jobs")
    .select(
      "id, personnel_id, employee_name, role_title, qr_code_data, status, created_at, printer_id"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DatabaseError("Failed to load print jobs", { table: "print_jobs", cause: error });
  }

  return (jobs ?? []) as CardPrintJob[];
}

/**
 * Cancel a queued print job
 */
export async function cancelNeo300Job(jobId: string) {
  const { supabase } = await assertAccessControlRole();

  const { error } = await supabase
    .from("print_jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId);

  if (error) {
    throw new DatabaseError("Failed to cancel job", { table: "print_jobs", cause: error });
  }

  revalidatePath("/access-control/print-cards");
  return { success: true };
}
