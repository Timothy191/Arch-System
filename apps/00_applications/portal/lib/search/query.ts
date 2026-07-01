import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import type { ArchSearchResult } from "./types";

type DbClient = SupabaseClient<Database>;

const MIN_QUERY_LENGTH = 2;
const PER_CATEGORY_LIMIT = 5;

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function departmentHref(name: string): string {
  return `/${name}`;
}

function shiftHref(departmentName: string, shiftDate: string): string {
  return `/${departmentName}/daily-log?date=${encodeURIComponent(shiftDate)}`;
}

export async function searchArch(
  supabase: DbClient,
  rawQuery: string,
): Promise<ArchSearchResult[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const term = query.replace(/[,()]/g, " ").trim();
  const pattern = `%${escapeIlike(term)}%`;
  const results: ArchSearchResult[] = [];
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(query) ? query : null;

  const [departmentsRes, employeesRes, shiftsRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, display_name, description")
      .or(`name.ilike.${pattern},display_name.ilike.${pattern},description.ilike.${pattern}`)
      .order("display_name", { ascending: true })
      .limit(PER_CATEGORY_LIMIT),
    supabase
      .from("employees")
      .select("id, full_name, employee_code, role, department_id")
      .is("deleted_at", null)
      .or(`full_name.ilike.${pattern},employee_code.ilike.${pattern},role.ilike.${pattern}`)
      .order("full_name", { ascending: true })
      .limit(PER_CATEGORY_LIMIT),
    (() => {
      let request = supabase
        .from("shift_status")
        .select("id, shift_date, shift_type, status, departments(name, display_name)")
        .order("shift_date", { ascending: false })
        .limit(PER_CATEGORY_LIMIT);

      if (isoDate) {
        request = request.eq("shift_date", isoDate);
      } else {
        request = request.or(`shift_type.ilike.${pattern},status.ilike.${pattern}`);
      }

      return request;
    })(),
  ]);

  for (const dept of departmentsRes.data ?? []) {
    results.push({
      id: `dept-${dept.id}`,
      category: "department",
      title: dept.display_name,
      subtitle: dept.description?.trim() || dept.name,
      href: departmentHref(dept.name),
    });
  }

  for (const employee of employeesRes.data ?? []) {
    const code = employee.employee_code?.trim();
    results.push({
      id: `emp-${employee.id}`,
      category: "employee",
      title: employee.full_name,
      subtitle: [code, employee.role].filter(Boolean).join(" · "),
      href: "/admin",
    });
  }

  for (const shift of shiftsRes.data ?? []) {
    const dept = shift.departments as { name: string; display_name: string } | null;
    if (!dept?.name) continue;

    const shiftLabel = shift.shift_type === "day" ? "Day shift" : "Night shift";
    const statusLabel = shift.status === "closed" ? "Closed" : "Open";

    results.push({
      id: `shift-${shift.id}`,
      category: "shift",
      title: `${dept.display_name} — ${shiftLabel}`,
      subtitle: `${shift.shift_date} · ${statusLabel}`,
      href: shiftHref(dept.name, shift.shift_date),
    });
  }

  return results;
}
