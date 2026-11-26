import { DEPARTMENTS, getDepartmentTabs } from '@repo/departments/data-access';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { notFound, redirect } from 'next/navigation';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';
import { getDeptId } from '@/lib/dept-registry';
import { hasAccessControlDepartmentPermission } from './actions/shared';

export default async function AccessControlLayout({ children }: { children: React.ReactNode }) {
  const dept = DEPARTMENTS.find((d) => d.name === 'access-control');
  if (!dept) notFound();

  const supabase = await createServerSupabaseClient();
  const [principal, accessControlDeptId] = await Promise.all([
    getAuthenticatedEmployee(supabase),
    getDeptId('access-control'),
  ]);

  if (!principal?.user) {
    redirect('/login');
  }
  if (
    !principal.employee ||
    !hasAccessControlDepartmentPermission(principal.employee, accessControlDeptId)
  ) {
    redirect('/hub');
  }

  const tabs = getDepartmentTabs('access-control');

  return (
    <>
      <ActiveDepartmentSetter department="access-control" />
      <DepartmentLayout department={dept} tabs={tabs}>
        {children}
      </DepartmentLayout>
    </>
  );
}
