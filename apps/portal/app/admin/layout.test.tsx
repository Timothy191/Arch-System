import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import AdminLayout from './layout';

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

jest.mock('@repo/ui/components/N8nIcon', () => ({
  N8nIcon: () => <span data-testid="n8n-icon" />,
}));

jest.mock('@repo/ui/components/RedisIcon', () => ({
  RedisIcon: () => <span data-testid="redis-icon" />,
}));

const { createServerSupabaseClient, getUserSafely } = jest.requireMock('@repo/supabase/server');

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated visitors to /login', async () => {
    getUserSafely.mockResolvedValue(null);
    createServerSupabaseClient.mockResolvedValue({});

    await expect(AdminLayout({ children: <div>Child</div> })).rejects.toThrow(
      'NEXT_REDIRECT:/login'
    );
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects non-admin operators to /', async () => {
    getUserSafely.mockResolvedValue({ id: 'user-1', email: 'op@plantcor.com' });
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'operator' } }),
          }),
        }),
      }),
    });

    await expect(AdminLayout({ children: <div>Child</div> })).rejects.toThrow('NEXT_REDIRECT:/');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('renders admin header links including Cloudflare Edge when role is admin', async () => {
    getUserSafely.mockResolvedValue({ id: 'admin-1', email: 'admin@plantcor.com' });
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    });

    const jsx = await AdminLayout({ children: <div data-testid="admin-child">Body</div> });
    render(jsx);

    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cloudflare Edge/i })).toHaveAttribute(
      'href',
      '/admin/cloudflare'
    );
    expect(screen.getByRole('link', { name: /n8n Workflows/i })).toHaveAttribute(
      'href',
      '/admin/workflows'
    );
    expect(screen.getByRole('link', { name: /RedisInsight/i })).toHaveAttribute(
      'href',
      '/admin/redis'
    );
    expect(screen.getByRole('link', { name: /Observability & CI/i })).toHaveAttribute(
      'href',
      '/admin/observability'
    );
  });
});
