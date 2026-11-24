import { createServerSupabaseClient } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AdminTabsClient } from '~/features/admin/components/AdminTabsClient';
import { resolveAdminAccess } from '~/features/admin/lib/admin-auth';
import { AuditLogsTab } from '~/features/admin/tabs/AuditLogsTab';
import { DepartmentsTab } from '~/features/admin/tabs/DepartmentsTab';
import { ExternalContentTab } from '~/features/admin/tabs/ExternalContentTab';
import { FleetTab } from '~/features/admin/tabs/FleetTab';
import { IntegrationsTab } from '~/features/admin/tabs/IntegrationsTab';
import { MineralsTab } from '~/features/admin/tabs/MineralsTab';
import { SettingsTab } from '~/features/admin/tabs/SettingsTab';
import { SitesTab } from '~/features/admin/tabs/SitesTab';
import { SystemLogsTab } from '~/features/admin/tabs/SystemLogsTab';
import { TargetsTab } from '~/features/admin/tabs/TargetsTab';
import { UsersTab } from '~/features/admin/tabs/UsersTab';
import { WebhooksTab } from '~/features/admin/tabs/WebhooksTab';

const TABS = [
  'users',
  'departments',
  'fleet',
  'sites',
  'minerals',
  'targets',
  'integrations',
  'webhooks',
  'audit-logs',
  'system-logs',
  'settings',
  'external-content',
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const access = await resolveAdminAccess('admin', createServerSupabaseClient);

  if (access === 'unauthenticated') {
    redirect('/login');
  }

  if (access === 'forbidden') {
    redirect('/');
  }

  const { tab: rawTab } = await searchParams;
  const activeTab = typeof rawTab === 'string' && TABS.includes(rawTab) ? rawTab : 'users';

  return (
    <div className="mx-auto w-full max-w-7xl p-lg">
      <AdminTabsClient activeTab={activeTab}>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'fleet' && <FleetTab />}
        {activeTab === 'sites' && <SitesTab />}
        {activeTab === 'minerals' && <MineralsTab />}
        {activeTab === 'targets' && <TargetsTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'webhooks' && <WebhooksTab />}
        {activeTab === 'audit-logs' && <AuditLogsTab />}
        {activeTab === 'system-logs' && <SystemLogsTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'external-content' && <ExternalContentTab />}
      </AdminTabsClient>
    </div>
  );
}
