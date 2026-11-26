import { createServerSupabaseClient } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';
import WorkflowsConsoleClient from './WorkflowsConsoleClient';

export default async function WorkflowsPage() {
  await connection();
  const access = await resolveRolesAccess(['admin'], createServerSupabaseClient);
  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status === 'forbidden') redirect('/');

  return <WorkflowsConsoleClient />;
}
