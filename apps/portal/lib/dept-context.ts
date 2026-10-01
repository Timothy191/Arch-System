import { DEPARTMENTS } from '@repo/departments/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getOperationalToday } from '@repo/utils';
import { notFound } from 'next/navigation';
import { getDeptId } from './dept-registry';

export async function getDepartmentContext(params: { department: string }): Promise<{
  dept: (typeof DEPARTMENTS)[number];
  deptId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  today: string;
}> {
  const dept = DEPARTMENTS.find((d) => d.name === params.department);
  if (!dept) notFound();

  const deptId = await getDeptId(params.department);
  if (!deptId) notFound();

  const supabase = await createServerSupabaseClient();
  const today = getOperationalToday();

  return {
    dept,
    deptId,
    supabase,
    today,
  };
}

export function requireDepartment(departmentSlug: string, allowed: string | string[]) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedList.includes(departmentSlug)) {
    notFound();
  }
}
