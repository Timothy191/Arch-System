import { render, screen } from '@testing-library/react';
import LoginPage from './page';

// Mock next/navigation
const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error(`NEXT_REDIRECT:${target}`);
  },
}));

// Mock cookies
const mockCookies = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock @repo/supabase/server
const mockGetUserSafely = jest.fn();
const mockCreateServerSupabaseClient = jest.fn();
jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
  getUserSafely: (...args: any[]) => mockGetUserSafely(...args),
}));

// Mock LoginForm
jest.mock('@/features/auth/components/LoginForm', () => ({
  LoginForm: () => <div data-testid="mock-login-form" />,
}));

// Mock EveStatusBar
jest.mock('@repo/ui/EveStatusBar', () => ({}));

// Mock GlassCard
jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children, className, style }: any) => (
    <div data-testid="mock-glass-card" className={className} style={style}>
      {children}
    </div>
  ),
}));

// Mock utils
jest.mock('@repo/utils', () => ({
  getThreeShift: jest.fn(() => ({
    shift: 'B',
    label: 'Shift B',
    start: '14:00',
    end: '22:00',
  })),
}));

describe('LoginPage Server Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => []),
    });
  });

  it('renders login page successfully for unauthenticated user', async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByTestId('mock-login-form')).toBeInTheDocument();

    const loginCard = screen.getByTestId('login-card');
    expect(loginCard.className).toContain('gold-steel-border');

    const logoSvg = loginCard.querySelector('svg');
    expect(logoSvg).not.toBeNull();
    expect(logoSvg?.getAttribute('class')).toContain('h-14');
    expect(logoSvg?.getAttribute('class')).toContain('w-14');
    expect(logoSvg?.getAttribute('class')).toContain('scale-110');
    expect(logoSvg?.parentElement?.className).toContain('h-12');
    expect(logoSvg?.parentElement?.className).toContain('w-12');

    const loginFooter = screen.getByTestId('login-footer');
    expect(loginFooter.className).toContain('text-[var(--accent-blue)]');
  });

  it('renders the heading with the theme token class and golden separator', async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    const heading = screen.getByRole('heading', { name: 'Arch Systems' });
    expect(heading).toHaveClass('text-[var(--text-heading)]');
    expect(heading).toHaveClass('font-display');
    expect(screen.getByTestId('arch-systems-gold-separator')).toBeInTheDocument();
    expect(screen.getByTestId('eve-agentic-backend-banner')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'eve' })).toBeInTheDocument();
    expect(screen.getByText(/Fully Intelligent & Agentic Backend/i)).toBeInTheDocument();
  });

  it('redirects authenticated user to /hub when no redirect param', async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: 'sb-mock-auth-token.0', value: 'token' }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockResolvedValue({ id: 'user-123' });

    await expect(LoginPage()).rejects.toThrow('NEXT_REDIRECT:/hub');
    expect(mockRedirect).toHaveBeenCalledWith('/hub');
  });

  it('redirects authenticated user to searchParams.redirect target', async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: 'sb-mock-auth-token', value: 'token' }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockResolvedValue({ id: 'user-123' });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ redirect: '/production' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/production');
    expect(mockRedirect).toHaveBeenCalledWith('/production');
  });

  it('auto-focuses the Retry link in the System Unavailable state (a11y)', async () => {
    // Auth cookie present but the auth check fails non-transiently ->
    // the System Unavailable card renders instead of the form.
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: 'sb-access-token', value: 'token' }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockRejectedValue(new Error('upstream auth outage'));

    const pageElement = await LoginPage();
    render(pageElement);

    const retry = screen.getByRole('link', { name: 'Retry' });
    expect(retry).toBeInTheDocument();
  });
});
