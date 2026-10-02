import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { AdminTabsClient } from '~/features/admin/components/AdminTabsClient';
import { AuditLogsTab } from '~/features/admin/tabs/AuditLogsTab';
import { DepartmentsTab } from '~/features/admin/tabs/DepartmentsTab';
import { FleetTab } from '~/features/admin/tabs/FleetTab';
import { IntegrationsTab } from '~/features/admin/tabs/IntegrationsTab';
import { SettingsTab } from '~/features/admin/tabs/SettingsTab';
import { SitesTab } from '~/features/admin/tabs/SitesTab';
import { UsersTab } from '~/features/admin/tabs/UsersTab';
import { WebhooksTab } from '~/features/admin/tabs/WebhooksTab';

const TABS = [
  'users',
  'departments',
  'fleet',
  'sites',
  'integrations',
  'webhooks',
  'audit-logs',
  'settings',
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const { tab: rawTab } = await searchParams;
  const activeTab = typeof rawTab === 'string' && TABS.includes(rawTab) ? rawTab : 'users';

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <AdminTabsClient activeTab={activeTab}>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'fleet' && <FleetTab />}
        {activeTab === 'sites' && <SitesTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'webhooks' && <WebhooksTab />}
        {activeTab === 'audit-logs' && <AuditLogsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </AdminTabsClient>
    </div>
  );
}
