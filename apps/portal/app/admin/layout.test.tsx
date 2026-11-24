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

jest.mock('@repo/ui/DepartmentLayout', () => ({
  DepartmentLayout: ({
    department,
    tabs,
    defaultPinned,
    children,
  }: {
    department: unknown;
    tabs: readonly unknown[];
    defaultPinned?: boolean;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="mock-department-layout"
      data-department-name={String((department as { name?: string })?.name)}
      data-default-pinned={String(Boolean(defaultPinned))}
    >
      <nav aria-label="Admin sidebar tabs">
        {(tabs as { name: string; label: string }[]).map((tab) => (
          <a key={tab.name} href={`/admin/${tab.name}`}>
            {tab.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

const { createServerSupabaseClient, getUserSafely } = jest.requireMock('@repo/supabase/server');

const mockSupabaseForRole = (role: string) => {
  createServerSupabaseClient.mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { role } }),
        }),
      }),
    }),
  });
};

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
    mockSupabaseForRole('operator');

    await expect(AdminLayout({ children: <div>Child</div> })).rejects.toThrow('NEXT_REDIRECT:/');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('renders the admin department layout with sidebar tabs', async () => {
    getUserSafely.mockResolvedValue({ id: 'admin-1', email: 'admin@plantcor.com' });
    mockSupabaseForRole('admin');

    const jsx = await AdminLayout({ children: <div data-testid="admin-child">Body</div> });
    render(jsx);

    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
    expect(screen.getByTestId('mock-department-layout')).toBeInTheDocument();
    expect(screen.getByTestId('mock-department-layout')).toHaveAttribute(
      'data-department-name',
      'admin'
    );
    expect(screen.getByTestId('mock-department-layout')).toHaveAttribute(
      'data-default-pinned',
      'true'
    );

    const sidebar = screen.getByRole('navigation', { name: /Admin sidebar tabs/i });
    expect(sidebar).toBeInTheDocument();

    const linkPairs = [
      [/Cloudflare Edge/i, '/admin/cloudflare'],
      [/n8n Workflows/i, '/admin/workflows'],
      [/RedisInsight/i, '/admin/redis'],
      [/Observability & CI/i, '/admin/observability'],
      [/AI Metrics/i, '/admin/ai-metrics'],
      [/General/i, '/admin/dashboard'],
    ] as const;
    for (const [name, href] of linkPairs) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
