import { ADMIN_DEPARTMENT, getDepartmentTabs } from '@repo/departments/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type React from 'react';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';
import { resolveAdminAccess } from '~/features/admin/lib/admin-auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const access = await resolveAdminAccess('admin', createServerSupabaseClient);

  if (access === 'unauthenticated') {
    redirect('/login');
  }

  if (access === 'forbidden') {
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
