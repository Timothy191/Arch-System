/**
 * @jest-environment node
 */

import { redirect } from 'next/navigation';
import { resolveRolesAccess } from '~/features/admin/lib/admin-auth';
import AdminPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
  getUserSafely: jest.fn(),
}));

jest.mock('~/features/admin/components/AdminTabsClient', () => ({
  AdminTabsClient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('~/features/admin/tabs/UsersTab', () => ({
  UsersTab: () => 'UsersTabContent',
}));
jest.mock('~/features/admin/tabs/DepartmentsTab', () => ({
  DepartmentsTab: () => 'DepartmentsTabContent',
}));
jest.mock('~/features/admin/tabs/FleetTab', () => ({
  FleetTab: () => 'FleetTabContent',
}));
jest.mock('~/features/admin/tabs/SitesTab', () => ({
  SitesTab: () => 'SitesTabContent',
}));
jest.mock('~/features/admin/tabs/IntegrationsTab', () => ({
  IntegrationsTab: () => 'IntegrationsTabContent',
}));
jest.mock('~/features/admin/tabs/WebhooksTab', () => ({
  WebhooksTab: () => 'WebhooksTabContent',
}));
jest.mock('~/features/admin/tabs/AuditLogsTab', () => ({
  AuditLogsTab: () => 'AuditLogsTabContent',
}));
jest.mock('~/features/admin/tabs/SystemLogsTab', () => ({
  SystemLogsTab: () => 'SystemLogsTabContent',
}));
jest.mock('~/features/admin/tabs/SettingsTab', () => ({
  SettingsTab: () => 'SettingsTabContent',
}));

const { createServerSupabaseClient, getUserSafely } = jest.requireMock('@repo/supabase/server');

function buildEmployeeSupabaseMock(role: string | null) {
  const single = jest.fn().mockResolvedValue({ data: role ? { role } : null });
  const is = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ is, single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { supabase: { from }, is, eq, single };
}

describe('AdminPage RBAC Authorization Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated user to /login', async () => {
    getUserSafely.mockResolvedValue(null);
    createServerSupabaseClient.mockResolvedValue({});

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/login'
    );
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects authenticated non-admin user to / and enforces deleted_at IS NULL', async () => {
    getUserSafely.mockResolvedValue({ id: 'user-1', email: 'regular@plantcor.com' });
    const { supabase, is } = buildEmployeeSupabaseMock('operator');
    createServerSupabaseClient.mockResolvedValue(supabase);

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/'
    );
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('strictly redirects previously backdoored email timothyoniel558@gmail.com if role is not admin', async () => {
    getUserSafely.mockResolvedValue({ id: 'user-2', email: 'timothyoniel558@gmail.com' });
    const { supabase } = buildEmployeeSupabaseMock('operator');
    createServerSupabaseClient.mockResolvedValue(supabase);

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/'
    );
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('rejects soft-deleted admin employees when deleted_at IS NULL filters out the row', async () => {
    getUserSafely.mockResolvedValue({ id: 'deleted-admin', email: 'ex-admin@plantcor.com' });
    const { supabase, is } = buildEmployeeSupabaseMock(null);

    const resolution = await resolveRolesAccess(['admin'], async () => supabase as never);
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(resolution).toEqual({ status: 'forbidden', role: null });
  });

  it('allows access when active employee role is admin', async () => {
    getUserSafely.mockResolvedValue({ id: 'admin-1', email: 'admin@plantcor.com' });
    const { supabase, is } = buildEmployeeSupabaseMock('admin');
    createServerSupabaseClient.mockResolvedValue(supabase);

    const jsx = await AdminPage({ searchParams: Promise.resolve({}) });
    expect(jsx).toBeDefined();
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(redirect).not.toHaveBeenCalled();
  });
});
