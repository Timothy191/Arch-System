/**
 * @jest-environment node
 */

import { redirect } from 'next/navigation';
import AdminRemoteSupportPage from './page';

const mockResolveRolesAccess = jest.fn();
const mockCreateServerSupabaseClient = jest.fn();
const mockGetUserSafely = jest.fn();

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('~/features/admin/lib/admin-auth', () => ({
  resolveRolesAccess: (...args: unknown[]) => mockResolveRolesAccess(...args),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
  getUserSafely: (...args: unknown[]) => mockGetUserSafely(...args),
}));

jest.mock('@/features/remote-support/components/RemoteSupportDesk', () => ({
  RemoteSupportDesk: (props: Record<string, unknown>) => props,
}));

describe('/admin/support/page.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated users to /login', async () => {
    mockResolveRolesAccess.mockResolvedValue({ status: 'unauthenticated', role: null });
    await expect(AdminRemoteSupportPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects forbidden users to /', async () => {
    mockResolveRolesAccess.mockResolvedValue({ status: 'forbidden', role: 'operator' });
    await expect(AdminRemoteSupportPage()).rejects.toThrow('NEXT_REDIRECT:/');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('hydrates sessions, devices, and audit events for supervisors and admins', async () => {
    mockResolveRolesAccess.mockResolvedValue({ status: 'authorized', role: 'supervisor' });
    mockGetUserSafely.mockResolvedValue({ id: 'auth-sup' });
    mockCreateServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'emp-sup', full_name: 'Jane Supervisor', role: 'supervisor' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'remote_support_sessions') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'sess-1', session_code: '123456' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'remote_support_devices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'dev-1', hostname: 'CR-01' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: 'aud-1', event_type: 'session_created' }],
                error: null,
              }),
            }),
          }),
        };
      }),
    });

    const element = await AdminRemoteSupportPage();
    expect(element.props.agentEmployeeId).toBe('emp-sup');
    expect(element.props.userRole).toBe('supervisor');
    expect(element.props.schemaReady).toBe(true);
    expect(element.props.initialSessions).toHaveLength(1);
    expect(element.props.initialDevices).toHaveLength(1);
    expect(element.props.initialAuditEvents).toHaveLength(1);
  });
});
