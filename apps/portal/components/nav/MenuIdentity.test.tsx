import '@testing-library/jest-dom';
import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { render, screen } from '@testing-library/react';
import { connection } from 'next/server';
import { getEmployeeIdentity } from '@/lib/hub-departments';
import { MenuIdentity } from './MenuIdentity';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
  getUserSafely: jest.fn(),
}));

jest.mock('@/lib/hub-departments', () => ({
  getEmployeeIdentity: jest.fn(),
}));

describe('MenuIdentity', () => {
  const mockConnection = connection as jest.Mock;
  const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock;
  const mockGetUserSafely = getUserSafely as jest.Mock;
  const mockGetEmployeeIdentity = getEmployeeIdentity as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('awaits connection() before creating Supabase client and renders signed-out link when unauthenticated', async () => {
    const callOrder: string[] = [];
    mockConnection.mockImplementation(async () => {
      callOrder.push('connection');
    });
    mockCreateServerSupabaseClient.mockImplementation(async () => {
      callOrder.push('createServerSupabaseClient');
      return { mock: true };
    });
    mockGetUserSafely.mockResolvedValue(null);

    const element = await MenuIdentity();
    render(element);

    expect(callOrder).toEqual(['connection', 'createServerSupabaseClient']);
    expect(mockGetEmployeeIdentity).not.toHaveBeenCalled();
    expect(screen.getByText('Not signed in')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/login');
  });

  it('awaits connection() and renders employee identity when authenticated', async () => {
    const callOrder: string[] = [];
    mockConnection.mockImplementation(async () => {
      callOrder.push('connection');
    });
    mockCreateServerSupabaseClient.mockImplementation(async () => {
      callOrder.push('createServerSupabaseClient');
      return { mock: true };
    });
    mockGetUserSafely.mockResolvedValue({
      id: 'user-1',
      email: 'ops@arch.co',
    });
    mockGetEmployeeIdentity.mockResolvedValue({
      fullName: 'Jane Smith',
      role: 'admin',
    });

    const element = await MenuIdentity();
    render(element);

    expect(callOrder).toEqual(['connection', 'createServerSupabaseClient']);
    expect(mockGetEmployeeIdentity).toHaveBeenCalledWith('user-1');
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/profile');
  });
});
