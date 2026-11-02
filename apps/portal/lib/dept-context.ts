import { DEPARTMENTS } from '@repo/departments/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getOperationalToday } from '@repo/utils';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getDeptId } from './dept-registry';

const getCachedDepartmentContextBySlug = cache(async (department: string) => {
  const dept = DEPARTMENTS.find((d) => d.name === department);
  if (!dept) notFound();

  const [deptId, supabase] = await Promise.all([
    getDeptId(department),
    createServerSupabaseClient(),
  ]);
  if (!deptId) notFound();

  const today = getOperationalToday();

  return {
    dept,
    deptId,
    supabase,
    today,
  };
});

export async function getDepartmentContext(params: { department: string }): Promise<{
  dept: (typeof DEPARTMENTS)[number];
  deptId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  today: string;
}> {
  return getCachedDepartmentContextBySlug(params.department);
}

export function requireDepartment(departmentSlug: string, allowed: string | string[]) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedList.includes(departmentSlug)) {
    notFound();
  }
}
