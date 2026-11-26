import { createServerSupabaseClient } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ObservabilityConsole } from '@/components/observability/ObservabilityConsole';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';

export default async function AdminObservabilityPage() {
  await connection();
  const access = await resolveRolesAccess(['admin'], createServerSupabaseClient);
  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status === 'forbidden') redirect('/');

  return <ObservabilityConsole />;
}
