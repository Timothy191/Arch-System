/**
 * @jest-environment node
 */

import { redirect } from 'next/navigation';
import AdminPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
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
jest.mock('~/features/admin/tabs/SettingsTab', () => ({
  SettingsTab: () => 'SettingsTabContent',
}));

const { createServerSupabaseClient, getUserSafely } = jest.requireMock('@repo/supabase/server');

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

  it('redirects authenticated non-admin user to /', async () => {
    getUserSafely.mockResolvedValue({ id: 'user-1', email: 'regular@plantcor.com' });
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'operator' } }),
          }),
        }),
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/'
    );
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('strictly redirects previously backdoored email timothyoniel558@gmail.com if role is not admin', async () => {
    getUserSafely.mockResolvedValue({ id: 'user-2', email: 'timothyoniel558@gmail.com' });
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'operator' } }),
          }),
        }),
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/'
    );
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('allows access when employee role is admin', async () => {
    getUserSafely.mockResolvedValue({ id: 'admin-1', email: 'admin@plantcor.com' });
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    };
    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    const jsx = await AdminPage({ searchParams: Promise.resolve({}) });
    expect(jsx).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
