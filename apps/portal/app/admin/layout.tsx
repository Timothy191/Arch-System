import { ADMIN_DEPARTMENT, getDepartmentTabs } from '@repo/departments/data-access';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type React from 'react';
import { ActiveDepartmentSetter } from '@/components/nav/ActiveDepartmentSetter';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';

const REMOTE_SUPPORT_PATH_PREFIX = '/admin/support';

async function readSafePathname(): Promise<string> {
  try {
    const headerStore = await headers();
    return headerStore?.get?.('x-arch-pathname') ?? '';
  } catch {
    return '';
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const pathname = await readSafePathname();
  const isSupportRoute =
    pathname === REMOTE_SUPPORT_PATH_PREFIX ||
    pathname.startsWith(`${REMOTE_SUPPORT_PATH_PREFIX}/`);

  const allowedRoles = isSupportRoute ? ['admin', 'supervisor'] : ['admin'];
  const access = await resolveRolesAccess(allowedRoles, createServerSupabaseClient);

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }

  if (access.status === 'forbidden') {
    redirect('/');
  }

  const allAdminTabs = getDepartmentTabs('admin');
  const visibleTabs =
    access.role === 'supervisor'
      ? allAdminTabs.filter((tab) => tab.name === 'support')
      : allAdminTabs;

  return (
    <>
      <ActiveDepartmentSetter department="admin" />
      <DepartmentLayout department={ADMIN_DEPARTMENT} tabs={visibleTabs} defaultPinned>
        {children}
      </DepartmentLayout>
    </>
  );
}
