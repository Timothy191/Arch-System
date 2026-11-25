import type {
  RemoteSupportAuditEventsRow,
  RemoteSupportDevicesRow,
  RemoteSupportSessionsRow,
} from '@repo/supabase';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { RemoteSupportDesk } from '@/features/remote-support/components/RemoteSupportDesk';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';

const ALLOWED_SUPPORT_ROLES = ['admin', 'supervisor'] as const;
const MAX_QUEUE_ITEMS = 50;
const MAX_DEVICES = 100;
const MAX_AUDIT_EVENTS = 100;

export default async function AdminRemoteSupportPage() {
  await connection();
  const access = await resolveRolesAccess(ALLOWED_SUPPORT_ROLES, createServerSupabaseClient);

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }
  if (access.status === 'forbidden') {
    redirect('/');
  }

  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  const [employeeResult, sessionsResult, devicesResult, auditResult] = await Promise.all([
    user
      ? supabase.from('employees').select('id, full_name, role').eq('auth_id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('remote_support_sessions')
      .select('*')
      .in('status', ['pending', 'claimed', 'consent_requested', 'active'])
      .order('created_at', { ascending: false })
      .limit(MAX_QUEUE_ITEMS),
    supabase
      .from('remote_support_devices')
      .select('*')
      .eq('is_active', true)
      .order('hostname', { ascending: true })
      .limit(MAX_DEVICES),
    supabase
      .from('remote_support_audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_AUDIT_EVENTS),
  ]);

  const missingTableCode = '42P01';
  const schemaReady =
    sessionsResult.error?.code !== missingTableCode &&
    devicesResult.error?.code !== missingTableCode;

  const employee = employeeResult.data as {
    id: string;
    full_name?: string | null;
    role: string;
  } | null;

  return (
    <RemoteSupportDesk
      agentEmployeeId={employee?.id ?? ''}
      agentName={employee?.full_name ?? 'Support Engineer'}
      userRole={access.role ?? employee?.role ?? 'supervisor'}
      initialSessions={(sessionsResult.data ?? []) as RemoteSupportSessionsRow[]}
      initialDevices={(devicesResult.data ?? []) as RemoteSupportDevicesRow[]}
      initialAuditEvents={(auditResult.data ?? []) as RemoteSupportAuditEventsRow[]}
      schemaReady={schemaReady}
    />
  );
}
