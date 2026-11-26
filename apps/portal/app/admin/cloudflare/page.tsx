import { createServerSupabaseClient } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { CloudflareInfrastructureConsole } from '@/components/cloudflare/CloudflareInfrastructureConsole';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';

export default async function AdminCloudflarePage() {
  await connection();
  const access = await resolveRolesAccess(['admin'], createServerSupabaseClient);
  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status === 'forbidden') redirect('/');

  return <CloudflareInfrastructureConsole />;
}
