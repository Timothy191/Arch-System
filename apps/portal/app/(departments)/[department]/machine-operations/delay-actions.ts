"use server";

// AGENT-TRACE: Server actions for delay entry CRUD operations with status validation
// These actions provide secure server-side operations for delay entries with role-based access control

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";

export interface DelayEntryInput {
  machine_operation_id: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string;
  is_manual_override: boolean;
  manual_duration_hours: number | null;
  description: string | null;
  status?: "draft" | "committed";
}

export interface DelayEntryUpdate extends Partial<DelayEntryInput> {
  id: string;
}

/**
 * Create a new delay entry
 * Only operators and supervisors in the same department can create draft entries
 */
export async function createDelayEntry(entry: DelayEntryInput) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Authentication required" };
  }

  // Get employee record
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, department_id, role, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  if (employeeError || !employee) {
    return { error: "Employee record not found" };
  }

  // Validate that the machine operation belongs to an accessible department
  const { data: machineOperation, error: opError } = await supabase
    .from("machine_operations")
    .select("department_id")
    .eq("id", entry.machine_operation_id)
    .single();

  if (opError || !machineOperation) {
    return { error: "Machine operation not found" };
  }

  // Check department access
  const hasAccess =
    employee.role === "admin" ||
    employee.department_id === machineOperation.department_id ||
    machineOperation.department_id ===
      ((employee.accessible_departments as string[]) || []).find(
        (d: string) => d === machineOperation.department_id,
      );

  if (!hasAccess) {
    return { error: "Access denied to this department" };
  }

  // Default status to draft
  const entryWithStatus: any = {
    ...entry,
    status: entry.status || "draft",
    created_by: employee.id,
  };

  // Only supervisors and admins can create committed entries
  if (entryWithStatus.status === "committed") {
    if (employee.role !== "supervisor" && employee.role !== "admin") {
      return { error: "Only supervisors can create committed entries" };
    }
    entryWithStatus.committed_at = new Date().toISOString();
    entryWithStatus.committed_by = employee.id;
  }

  // Insert the delay entry
  const { data, error } = await supabase
    .from("delay_entries")
    .insert(entryWithStatus)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Revalidate the machine operations page
  revalidatePath(`/[department]/machine-operations`);

  return { data, error: null };
}

/**
 * Update an existing delay entry
 * Only draft entries can be updated, and only by authorized users
 */
export async function updateDelayEntry(entry: DelayEntryUpdate) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Authentication required" };
  }

  // Get employee record
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, department_id, role, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  if (employeeError || !employee) {
    return { error: "Employee record not found" };
  }

  // Get the existing delay entry to check status and department
  const { data: existingEntry, error: fetchError } = await supabase
    .from("delay_entries")
    .select("*, machine_operation:machine_operations(department_id)")
    .eq("id", entry.id)
    .single();

  if (fetchError || !existingEntry) {
    return { error: "Delay entry not found" };
  }

  // Check if entry is committed (locked for editing)
  if (existingEntry.status === "committed") {
    return { error: "Cannot update committed entries" };
  }

  // Check department access
  const machineOperation = existingEntry.machine_operation as any;
  const hasAccess =
    employee.role === "admin" ||
    employee.department_id === machineOperation.department_id ||
    machineOperation.department_id ===
      ((employee.accessible_departments as string[]) || []).find(
        (d: string) => d === machineOperation.department_id,
      );

  if (!hasAccess) {
    return { error: "Access denied to this department" };
  }

  // Prepare update data
  const updateData: any = {
    ...entry,
    updated_at: new Date().toISOString(),
  };

  // Remove id from update data
  delete updateData.id;

  // If updating to committed status, add audit fields
  if (entry.status === "committed") {
    if (employee.role !== "supervisor" && employee.role !== "admin") {
      return { error: "Only supervisors can commit entries" };
    }
    updateData.committed_at = new Date().toISOString();
    updateData.committed_by = employee.id;
  }

  // Update the delay entry
  const { data, error } = await supabase
    .from("delay_entries")
    .update(updateData)
    .eq("id", entry.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Revalidate the machine operations page
  revalidatePath(`/[department]/machine-operations`);

  return { data, error: null };
}

/**
 * Delete a delay entry
 * Only draft entries can be deleted, and only by authorized users
 */
export async function deleteDelayEntry(id: string) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Authentication required" };
  }

  // Get employee record
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, department_id, role, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  if (employeeError || !employee) {
    return { error: "Employee record not found" };
  }

  // Get the existing delay entry to check status and department
  const { data: existingEntry, error: fetchError } = await supabase
    .from("delay_entries")
    .select("*, machine_operation:machine_operations(department_id)")
    .eq("id", id)
    .single();

  if (fetchError || !existingEntry) {
    return { error: "Delay entry not found" };
  }

  // Check if entry is committed (locked for deletion)
  if (existingEntry.status === "committed") {
    return { error: "Cannot delete committed entries" };
  }

  // Check department access
  const machineOperation = existingEntry.machine_operation as any;
  const hasAccess =
    employee.role === "admin" ||
    employee.department_id === machineOperation.department_id ||
    machineOperation.department_id ===
      ((employee.accessible_departments as string[]) || []).find(
        (d: string) => d === machineOperation.department_id,
      );

  if (!hasAccess) {
    return { error: "Access denied to this department" };
  }

  // Delete the delay entry
  const { error } = await supabase.from("delay_entries").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  // Revalidate the machine operations page
  revalidatePath(`/[department]/machine-operations`);

  return { error: null };
}

/**
 * Get delay entries for a specific machine operation
 */
export async function getDelayEntriesForOperation(machineOperationId: string) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Authentication required", data: null };
  }

  // Get employee record
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, department_id, role, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  if (employeeError || !employee) {
    return { error: "Employee record not found", data: null };
  }

  // Get delay entries with related data
  const { data, error } = await supabase
    .from("delay_entries")
    .select(
      "*, delay_category:delay_categories(*), machine_operation:machine_operations(department_id)",
    )
    .eq("machine_operation_id", machineOperationId)
    .order("delay_start_time");

  if (error) {
    return { error: error.message, data: null };
  }

  // Filter by department access
  const filteredData = (data || []).filter((entry) => {
    const machineOperation = entry.machine_operation as any;
    return (
      employee.role === "admin" ||
      employee.department_id === machineOperation.department_id ||
      machineOperation.department_id ===
        ((employee.accessible_departments as string[]) || []).find(
          (d: string) => d === machineOperation.department_id,
        )
    );
  });

  return { data: filteredData, error: null };
}
