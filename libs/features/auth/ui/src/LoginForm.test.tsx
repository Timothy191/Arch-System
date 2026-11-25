import { useLogin } from '@repo/auth/data-access';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { LoginForm } from './index';

jest.mock('@repo/auth/data-access', () => ({
  useLogin: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly href: string;
    readonly className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const mockedUseLogin = useLogin as jest.MockedFunction<typeof useLogin>;
const mockedNavigation = jest.requireMock('next/navigation') as {
  readonly useRouter: jest.Mock;
  readonly useSearchParams: jest.Mock;
};

const RATE_LIMIT_SECONDS = 30;

describe('LoginForm (@repo/auth/ui)', () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();
  const mockLogin = jest.fn();
  const mockSetRateLimitCountdown = jest.fn();

  function configureSearchParams(paramsRecord: Record<string, string> = {}) {
    mockedNavigation.useSearchParams.mockReturnValue({
      get: jest.fn((key: string) => paramsRecord[key] ?? null),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedNavigation.useRouter.mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    configureSearchParams();
    mockedUseLogin.mockReturnValue({
      login: mockLogin,
      loading: false,
      rateLimitCountdown: null,
      setRateLimitCountdown: mockSetRateLimitCountdown,
    });
  });

  it('should render email and password inputs, light-mode glass styling, and visitor QR trigger', () => {
    const { container } = render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('username@arch-systems.io');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(emailInput.parentElement?.className).toContain('liquid-glass-light');
    expect(emailInput.parentElement?.className).toContain('gold-steel-border');
    expect(passwordInput.parentElement?.className).toContain('liquid-glass-light');

    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    expect(signInButton).toBeInTheDocument();
    expect(signInButton.className).toContain('bg-[var(--color-action-primary)]');
    expect(signInButton.className).toContain('text-[var(--text-on-glass)]');

    expect(screen.getByTestId('enterprise-auth-addons')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visitor QR Code/i })).toBeInTheDocument();
    expect(screen.queryByText(/Enter ↵/i)).not.toBeInTheDocument();
    expect(container.querySelector('kbd')).toBeNull();
  });

  it('should prefill email from searchParams and allow clearing via the clear button', () => {
    configureSearchParams({ email: 'engineer@arch-systems.io' });

    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('username@arch-systems.io') as HTMLInputElement;
    expect(emailInput.value).toBe('engineer@arch-systems.io');

    const clearButton = screen.getByRole('button', { name: 'Clear email address' });
    fireEvent.click(clearButton);

    expect(emailInput.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear email address' })).not.toBeInTheDocument();
  });

  it('should validate malformed email addresses on blur and update the Forgot password link', () => {
    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('username@arch-systems.io');
    fireEvent.change(emailInput, { target: { value: 'invalid-email@' } });
    fireEvent.blur(emailInput);

    expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');

    const forgotPasswordLink = screen.getByRole('link', { name: /Forgot password\?/i });
    expect(forgotPasswordLink).toHaveAttribute(
      'href',
      `/reset-password?email=${encodeURIComponent('invalid-email@')}`
    );
  });

  it('should toggle password visibility and update credential readiness status text', () => {
    render(<LoginForm />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByText('Encrypted session handoff')).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: 'StrongMiningPass#1' } });
    expect(screen.getByText('Credentials ready')).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should display and clear the Caps Lock warning on key events', () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText('••••••••');

    const capsOnEvent = new KeyboardEvent('keydown', { key: 'A', bubbles: true });
    Object.defineProperty(capsOnEvent, 'getModifierState', {
      value: (modifier: string) => modifier === 'CapsLock',
    });
    fireEvent(passwordInput, capsOnEvent);

    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();

    const capsOffEvent = new KeyboardEvent('keyup', { key: 'a', bubbles: true });
    Object.defineProperty(capsOffEvent, 'getModifierState', {
      value: () => false,
    });
    fireEvent(passwordInput, capsOffEvent);

    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });

  it('should submit credentials and navigate to valid internal redirect target on success', async () => {
    configureSearchParams({ redirect: '/drilling/operations' });
    mockLogin.mockResolvedValueOnce({ success: true });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'operator@arch-systems.io' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'ValidPassword123' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('operator@arch-systems.io', 'ValidPassword123');
    });

    expect(mockPush).toHaveBeenCalledWith('/drilling/operations');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should sanitize unsafe or /login redirect targets back to /', async () => {
    const unsafeRedirects: readonly string[] = [
      'https://malicious.example.com/hub',
      '//malicious.example.com',
      '/login?redirect=/hub',
      '/assets/logo.png',
    ];

    for (const unsafeRedirect of unsafeRedirects) {
      configureSearchParams({ redirect: unsafeRedirect });
      mockLogin.mockResolvedValueOnce({ success: true });

      const { unmount } = render(<LoginForm />);

      fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
        target: { value: 'operator@arch-systems.io' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'ValidPassword123' },
      });
      fireEvent.submit(screen.getByTestId('login-form'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });

      unmount();
      jest.clearAllMocks();
      mockedNavigation.useRouter.mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
      });
      mockedUseLogin.mockReturnValue({
        login: mockLogin,
        loading: false,
        rateLimitCountdown: null,
        setRateLimitCountdown: mockSetRateLimitCountdown,
      });
    }
  });

  it('should render inline error message on failed login and clear it when password changes', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      error: 'Invalid email or employee badge code.',
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'operator@arch-systems.io' },
    });
    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passwordInput, {
      target: { value: 'WrongPassword123' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or employee badge code.');
    });
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.change(passwordInput, { target: { value: 'UpdatedPassword123' } });
    expect(screen.queryByText('Invalid email or employee badge code.')).not.toBeInTheDocument();
  });

  it('should disable form controls and prevent submission while rate-limited or loading', () => {
    mockedUseLogin.mockReturnValue({
      login: mockLogin,
      loading: false,
      rateLimitCountdown: RATE_LIMIT_SECONDS,
      setRateLimitCountdown: mockSetRateLimitCountdown,
    });

    render(<LoginForm />);

    expect(
      screen.getByText(`Too many attempts. Try again in ${RATE_LIMIT_SECONDS}s`)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('username@arch-systems.io')).toBeDisabled();
    expect(screen.getByPlaceholderText('••••••••')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDisabled();

    fireEvent.submit(screen.getByTestId('login-form'));
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should open and close RequestVisitorModal when Visitor QR Code button is clicked', () => {
    render(<LoginForm renderQrCode={(qrCode) => <div data-testid="custom-qr">{qrCode}</div>} />);

    const visitorButton = screen.getByRole('button', { name: /Visitor QR Code/i });
    expect(visitorButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(visitorButton);
    expect(screen.getByRole('dialog', { name: /Request Visitor Pass/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Close visitor pass dialog/i }));
    expect(screen.queryByRole('dialog', { name: /Request Visitor Pass/i })).not.toBeInTheDocument();
  });
});
