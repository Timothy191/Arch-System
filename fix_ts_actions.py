import re

filepath = "apps/portal/app/(departments)/access-control/actions.ts"
with open(filepath, "r") as f:
    c = f.read()

# Replace assert function with overload
old_assert = """async function assertAccessControlRole(options?: { requireWrite?: boolean }) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (options?.requireWrite) {
    if (!principal?.employee) {
      throw new AuthError('Unauthorized: employee profile required for access control mutations');
    }
    if (!['admin', 'access_control', 'supervisor'].includes(principal.employee.role)) {
      throw new ForbiddenError('Forbidden: access_control, admin or supervisor role required', {
        resource: 'access_control',
        action: 'assert_role',
      });
    }
  }

  // Permissive read access for all authenticated staff (operator, supervisor, admin, access_control)
  const user = principal?.user ?? null;
  const employee = principal?.employee ?? null;
  return { supabase, user, employee };
}"""

new_assert = """async function assertAccessControlRole(options: { requireWrite: true }): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: any;
  employee: NonNullable<Awaited<ReturnType<typeof getAuthenticatedEmployee>> extends { employee: infer E } ? E : any>;
}>;
async function assertAccessControlRole(options?: { requireWrite?: boolean }): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: any;
  employee: any;
}>;
async function assertAccessControlRole(options?: { requireWrite?: boolean }) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);

  if (options?.requireWrite) {
    if (!principal?.employee) {
      throw new AuthError('Unauthorized: employee profile required for access control mutations');
    }
    if (!['admin', 'access_control', 'supervisor'].includes(principal.employee.role)) {
      throw new ForbiddenError('Forbidden: access_control, admin or supervisor role required', {
        resource: 'access_control',
        action: 'assert_role',
      });
    }
    return { supabase, user: principal.user, employee: principal.employee };
  }

  // Permissive read access for all authenticated staff (operator, supervisor, admin, access_control)
  const user = principal?.user ?? null;
  const employee = principal?.employee ?? null;
  return { supabase, user, employee };
}"""

c = c.replace(old_assert, new_assert)

# Replace full_name in triggerGatePulse
c = c.replace("Authorized by ${employee?.full_name ?? 'Supervisor'}", "Authorized by Supervisor (${employee?.role ?? 'admin'})")

# Replace muster indexing
c = c.replace("const assignedStation = isAccounted ? stations[index % stations.length].name : null;\n    if (isAccounted && assignedStation) {\n      stations[index % stations.length].count += 1;\n    }", """const targetSt = stations[index % stations.length] ?? stations[0]!;
    const assignedStation = isAccounted ? targetSt.name : null;
    if (isAccounted && assignedStation) {
      targetSt.count += 1;
    }""")

c = c.replace("const assignedStation = isAccounted ? stations[2].name : null;\n    if (isAccounted) {\n      stations[2].count += 1;\n    }", """const stCharlie = stations[2] ?? stations[0]!;
    const assignedStation = isAccounted ? stCharlie.name : null;
    if (isAccounted) {
      stCharlie.count += 1;
    }""")

with open(filepath, "w") as f:
    f.write(c)

