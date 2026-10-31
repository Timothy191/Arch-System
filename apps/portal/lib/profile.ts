import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';

/** A department resolved from the `departments` table into a display-ready shape. */
export interface ProfileDepartment {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

/**
 * Everything the profile surface renders, resolved from the authenticated
 * employee's own row. `employees` only stores `full_name`, `role`,
 * `department_id`, `accessible_departments`, `created_at` and `updated_at`, so
 * every field here maps to a real column — nothing is synthesised.
 */
export interface ProfileDetails {
  readonly employeeId: string | null;
  readonly email: string | null;
  readonly fullName: string;
  readonly initials: string;
  readonly role: string;
  readonly roleLabel: string;
  readonly primaryDepartment: ProfileDepartment | null;
  readonly accessibleDepartments: readonly ProfileDepartment[];
  readonly memberSince: string | null;
  readonly lastUpdated: string | null;
}

/** Inputs for {@link buildProfileDetails}; grouped to keep the call site 2-arity. */
export interface ProfileSource {
  readonly email: string | null;
  readonly employee: EmployeeRow | null;
  readonly departments: readonly DepartmentRow[];
}

export interface EmployeeRow {
  readonly id: string;
  readonly full_name: string;
  readonly role: string;
  readonly department_id: string | null;
  readonly accessible_departments: string[] | null;
  readonly created_at: string;
  readonly updated_at: string | null;
}

export interface DepartmentRow {
  readonly id: string;
  readonly name: string;
  readonly display_name: string;
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  operator: 'Operator',
  control_room_operator: 'Control Room Operator',
  access_control: 'Access Control Officer',
};

const PROFILE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

const PROFILE_LOCALE = 'en-ZA';
const EMAIL_SEPARATOR_PATTERN = /[._-]+/g;
const WHITESPACE_PATTERN = /\s+/;
const UNASSIGNED_ROLE_LABEL = 'Unassigned';
const UNKNOWN_NAME_LABEL = 'Signed-in user';

/** Turn a stored role slug into a human label without inventing privileges. */
export function formatRoleLabel(role: string): string {
  if (!role.trim()) return UNASSIGNED_ROLE_LABEL;
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

/** First letters of the first two words, matching the `Avatar` letter contract. */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(WHITESPACE_PATTERN).filter(Boolean);
  const first = words[0];
  const second = words[1];
  if (first && second) {
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  return '?';
}

/** ISO timestamp → short operational date; `null` when absent or unparseable. */
export function formatProfileDate(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(PROFILE_LOCALE, PROFILE_DATE_FORMAT);
}

/** Readable name for an auth account that has no employee row yet. */
export function formatDisplayNameFromEmail(email: string | null): string {
  const localPart = email?.split('@')[0]?.replaceAll(EMAIL_SEPARATOR_PATTERN, ' ').trim();
  if (!localPart) return UNKNOWN_NAME_LABEL;
  return localPart;
}

function toProfileDepartment(department: DepartmentRow): ProfileDepartment {
  return {
    id: department.id,
    name: department.name,
    displayName: department.display_name,
  };
}

function resolveAccessibleDepartments(
  accessibleDepartmentIds: readonly string[],
  departmentById: ReadonlyMap<string, ProfileDepartment>
): readonly ProfileDepartment[] {
  const resolved: ProfileDepartment[] = [];
  const seen = new Set<string>();
  for (const departmentId of accessibleDepartmentIds) {
    const department = departmentById.get(departmentId);
    if (!department || seen.has(department.id)) continue;
    seen.add(department.id);
    resolved.push(department);
  }
  return resolved;
}

/** Pure mapping from database rows to the profile view model (unit-testable). */
export function buildProfileDetails(source: ProfileSource): ProfileDetails {
  const departmentById = new Map(
    source.departments.map((department) => [department.id, toProfileDepartment(department)])
  );

  const employee = source.employee;
  const employeeName = employee?.full_name?.trim() ?? '';
  const fullName = employeeName || formatDisplayNameFromEmail(source.email);
  const role = employee?.role ?? '';
  const primaryDepartment = employee?.department_id
    ? (departmentById.get(employee.department_id) ?? null)
    : null;

  return {
    employeeId: employee?.id ?? null,
    email: source.email,
    fullName,
    initials: getInitials(fullName),
    role,
    roleLabel: formatRoleLabel(role),
    primaryDepartment,
    accessibleDepartments: resolveAccessibleDepartments(
      employee?.accessible_departments ?? [],
      departmentById
    ),
    memberSince: formatProfileDate(employee?.created_at ?? null),
    lastUpdated: formatProfileDate(employee?.updated_at ?? null),
  };
}

/**
 * Resolve the current employee's profile from the verified session.
 *
 * Returns `null` when there is no verified identity so the caller can redirect
 * to `/login`. Both queries are scoped by RLS to the caller's own records.
 */
export async function getProfileDetails(): Promise<ProfileDetails | null> {
  const supabase = await createServerSupabaseClient();
  const identity = await getUserSafely(supabase);
  if (!identity) return null;

  const [employeeResult, departmentResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, department_id, accessible_departments, created_at, updated_at')
      .eq('auth_id', identity.id)
      .maybeSingle(),
    supabase.from('departments').select('id, name, display_name').order('display_name'),
  ]);

  return buildProfileDetails({
    email: identity.email,
    employee: employeeResult.data,
    departments: departmentResult.data ?? [],
  });
}
