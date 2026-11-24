import { ADMIN_DEPARTMENT, getDepartmentTabs } from '@repo/departments/data-access';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type React from 'react';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    redirect('/login');
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (employee?.role !== 'admin') {
    redirect('/');
  }

  return (
    <>
      <ActiveDepartmentSetter department="admin" />
      <DepartmentLayout
        department={ADMIN_DEPARTMENT}
        tabs={getDepartmentTabs('admin')}
        defaultPinned
      >
        {children}
      </DepartmentLayout>
    </>
  );
}
