"use server";

// AGENT-TRACE: Server actions for commit/uncommit workflow with supervisor authorization
// Provides secure workflow for transitioning delay entries from draft to committed status
// Includes comprehensive audit trail for uncommit operations

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";

export interface CommitDelaysInput {
  delay_entry_ids: string[];
}

export interface UncommitDelaysInput extends CommitDelaysInput {
  uncommit_reason: string;
}

/**
 * Commit draft delay entries
 * Only supervisors and admins can commit entries
 * This transitions delays from draft to committed status, locking them for editing
 */
export async function commitDelays(input: CommitDelaysInput) {
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

  // Check supervisor/admin authorization
  if (employee.role !== "supervisor" && employee.role !== "admin") {
    return { error: "Only supervisors can commit delay entries" };
  }

  // Get the delay entries to verify they exist and are draft
  const { data: delayEntries, error: fetchError } = await supabase
    .from("delay_entries")
    .select("*, machine_operation:machine_operations(department_id)")
    .in("id", input.delay_entry_ids);

  if (fetchError) {
    return { error: "Failed to fetch delay entries" };
  }

  if (!delayEntries || delayEntries.length === 0) {
    return { error: "No delay entries found" };
  }

  // Check department access and status for each entry
  const errors: string[] = [];
  const validEntries: string[] = [];

  for (const entry of delayEntries) {
    const machineOperation = entry.machine_operation as any;

    // Check department access
    const hasAccess =
      employee.role === "admin" ||
      employee.department_id === machineOperation.department_id ||
      machineOperation.department_id ===
        (employee.accessible_departments || []).find(
          // AGENT-TRACE: Explicitly type the parameter to string to avoid implicit any compiler error
          (d: string) => d === machineOperation.department_id,
        );

    if (!hasAccess) {
      errors.push(
        `No access to delay entry in department ${machineOperation.department_id}`,
      );
      continue;
    }

    // Check if already committed
    if (entry.status === "committed") {
      errors.push(`Delay entry ${entry.id} is already committed`);
      continue;
    }

    validEntries.push(entry.id);
  }

  if (errors.length > 0) {
    return { error: errors.join("; ") };
  }

  if (validEntries.length === 0) {
    return { error: "No valid entries to commit" };
  }

  // Commit all valid entries
  const commitData = {
    status: "committed",
    committed_at: new Date().toISOString(),
    committed_by: employee.id,
  };

  const { error } = await supabase
    .from("delay_entries")
    .update(commitData)
    .in("id", validEntries);

  if (error) {
    return { error: error.message };
  }

  // Revalidate the machine operations page
  revalidatePath(`/[department]/machine-operations`);

  return {
    error: null,
    committed_count: validEntries.length,
  };
}

/**
 * Uncommit committed delay entries (supervisor override)
 * Only supervisors and admins can uncommit entries
 * Requires mandatory reason field for audit trail
 */
export async function uncommitDelays(input: UncommitDelaysInput) {
  const supabase = await createServerSupabaseClient();

  // Validate uncommit reason
  if (!input.uncommit_reason || input.uncommit_reason.trim().length === 0) {
    return { error: "Uncommit reason is required for audit trail" };
  }

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

  // Check supervisor/admin authorization
  if (employee.role !== "supervisor" && employee.role !== "admin") {
    return { error: "Only supervisors can uncommit delay entries" };
  }

  // Get the delay entries to verify they exist and are committed
  const { data: delayEntries, error: fetchError } = await supabase
    .from("delay_entries")
    .select("*, machine_operation:machine_operations(department_id)")
    .in("id", input.delay_entry_ids);

  if (fetchError) {
    return { error: "Failed to fetch delay entries" };
  }

  if (!delayEntries || delayEntries.length === 0) {
    return { error: "No delay entries found" };
  }

  // Check department access and status for each entry
  const errors: string[] = [];
  const validEntries: string[] = [];

  for (const entry of delayEntries) {
    const machineOperation = entry.machine_operation as any;

    // Check department access
    const hasAccess =
      employee.role === "admin" ||
      employee.department_id === machineOperation.department_id ||
      machineOperation.department_id ===
        (employee.accessible_departments || []).find(
          // AGENT-TRACE: Explicitly type the parameter to string to avoid implicit any compiler error
          (d: string) => d === machineOperation.department_id,
        );

    if (!hasAccess) {
      errors.push(
        `No access to delay entry in department ${machineOperation.department_id}`,
      );
      continue;
    }

    // Check if already draft
    if (entry.status === "draft") {
      errors.push(`Delay entry ${entry.id} is already in draft status`);
      continue;
    }

    validEntries.push(entry.id);
  }

  if (errors.length > 0) {
    return { error: errors.join("; ") };
  }

  if (validEntries.length === 0) {
    return { error: "No valid entries to uncommit" };
  }

  // Uncommit all valid entries with audit trail
  const uncommitData = {
    status: "draft",
    uncommitted_at: new Date().toISOString(),
    uncommitted_by: employee.id,
    uncommit_reason: input.uncommit_reason.trim(),
  };

  const { error } = await supabase
    .from("delay_entries")
    .update(uncommitData)
    .in("id", validEntries);

  if (error) {
    return { error: error.message };
  }

  // Revalidate the machine operations page
  revalidatePath(`/[department]/machine-operations`);

  return {
    error: null,
    uncommitted_count: validEntries.length,
  };
}

/**
 * Get commit history for a specific delay entry
 * Returns audit trail of commit/uncommit actions
 */
export async function getDelayEntryHistory(delayEntryId: string) {
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

  // Get the delay entry with commit history
  const { data: delayEntry, error: fetchError } = await supabase
    .from("delay_entries")
    .select(
      "*, machine_operation:machine_operations(department_id), committed_by_employee:employees(full_name, employee_code), uncommitted_by_employee:employees(full_name, employee_code)",
    )
    .eq("id", delayEntryId)
    .single();

  if (fetchError || !delayEntry) {
    return { error: "Delay entry not found", data: null };
  }

  // Check department access
  const machineOperation = delayEntry.machine_operation as any;
  const hasAccess =
    employee.role === "admin" ||
    employee.department_id === machineOperation.department_id ||
    machineOperation.department_id ===
      ((employee.accessible_departments as string[]) || []).find(
        (d: string) => d === machineOperation.department_id,
      );

  if (!hasAccess) {
    return { error: "Access denied", data: null };
  }

  // Build history object
  const history = {
    delay_entry: {
      id: delayEntry.id,
      status: delayEntry.status,
      created_at: delayEntry.created_at,
    },
    commit_history: delayEntry.committed_at
      ? {
          committed_at: delayEntry.committed_at,
          committed_by:
            (delayEntry.committed_by_employee as any)?.full_name || "Unknown",
          committed_by_code:
            (delayEntry.committed_by_employee as any)?.employee_code || null,
        }
      : null,
    uncommit_history: delayEntry.uncommitted_at
      ? {
          uncommitted_at: delayEntry.uncommitted_at,
          uncommitted_by:
            (delayEntry.uncommitted_by_employee as any)?.full_name || "Unknown",
          uncommitted_by_code:
            (delayEntry.uncommitted_by_employee as any)?.employee_code || null,
          uncommit_reason: delayEntry.uncommit_reason,
        }
      : null,
  };

  return { data: history, error: null };
}
