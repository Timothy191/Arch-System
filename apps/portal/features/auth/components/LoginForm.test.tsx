import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { LoginForm } from './LoginForm';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: jest.fn(({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )),
}));

jest.mock('@repo/ui/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@repo/ui/AnimatedButton', () => ({
  AnimatedButton: ({
    children,
    disabled,
    className,
    type,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type={type} disabled={disabled} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

const { useRouter, useSearchParams } = jest.requireMock('next/navigation');

describe('LoginForm', () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    useSearchParams.mockReturnValue({
      get: jest.fn(() => null),
    });
    global.fetch = jest.fn();
  });

  it('renders employee ID and password inputs and mode switcher', () => {
    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('username@arch-systems.io');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(emailInput.parentElement?.className).toContain('gold-steel-border');
    expect(passwordInput.parentElement?.className).toContain('gold-steel-border');
    expect(screen.queryByTestId('auth-mode-switcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /SSO/i })).not.toBeInTheDocument();

    const signInBtn = screen.getByRole('button', { name: /^Access Arch Systems$|^Sign In$/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn.className).toContain('bg-amber-500');
    expect(signInBtn.className).toContain('text-zinc-950');
    expect(signInBtn.className).toContain('rounded-xl');
    expect(signInBtn.className).toContain('gold-steel-border');
  });

  it('does not render the dead remember-me checkbox and renders enterprise auth add-ons', () => {
    render(<LoginForm />);

    expect(screen.queryByLabelText(/remember this device/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('enterprise-auth-addons')).toBeInTheDocument();
    expect(screen.getByText(/Audit-Logged RBAC/i)).toBeInTheDocument();

    const visitorTrigger = screen.getByRole('button', { name: /Visitor QR Code/i });
    expect(visitorTrigger).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Visitor QR Code/i })).not.toBeInTheDocument();
  });

  it('opens the quick Visitor Request popup without navigating or logging in, and displays a pending VIS-* QR code on submit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({
        success: true,
        pass: {
          qrCode: 'VIS-749201',
          visitorId: 'vis-001',
          fullName: 'Sipho Dlamini',
          company: 'Komatsu SA',
          visiting: 'Engineering Workshop',
          status: 'Pre-Registered',
          expiresAt: '2026-11-13T00:00:00.000Z',
        },
      }),
    });

    render(<LoginForm />);

    const visitorTrigger = screen.getByRole('button', { name: /Visitor QR Code/i });
    fireEvent.click(visitorTrigger);

    const dialog = screen.getByRole('dialog', { name: /Request Visitor Pass/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: 'Sipho' },
    });
    fireEvent.change(screen.getByLabelText(/Surname/i), {
      target: { value: 'Dlamini' },
    });
    fireEvent.change(screen.getByLabelText(/Company/i), {
      target: { value: 'Komatsu SA' },
    });
    fireEvent.change(screen.getByLabelText(/Person \/ Department Visiting/i), {
      target: { value: 'Engineering Workshop' },
    });
    fireEvent.change(screen.getByLabelText(/Reason for Visit/i), {
      target: { value: 'Excavator bucket inspection' },
    });

    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/visitor-request',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            first_name: 'Sipho',
            surname: 'Dlamini',
            company: 'Komatsu SA',
            visiting: 'Engineering Workshop',
            reason_for_entry: 'Excavator bucket inspection',
            id_number: null,
          }),
        })
      );
    });

    // Must NOT have triggered operator login or navigation
    expect(mockPush).not.toHaveBeenCalled();

    // Displays pending VIS-* QR code and Pre-Registered badge inside popup
    await waitFor(() => {
      expect(screen.getByText('VIS-749201')).toBeInTheDocument();
    });
    expect(screen.getByText(/Pre-Registered/i)).toBeInTheDocument();

    // Closing popup returns cleanly to login view
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
    expect(screen.queryByRole('dialog', { name: /Request Visitor Pass/i })).not.toBeInTheDocument();
  });

  it('shows inline error in the Visitor Request popup when submission fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({
        success: false,
        error: 'Too many visitor pass requests. Please try again shortly.',
      }),
    });

    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: /Visitor QR Code/i }));
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Sipho' } });
    fireEvent.change(screen.getByLabelText(/Surname/i), { target: { value: 'Dlamini' } });
    fireEvent.change(screen.getByLabelText(/Company/i), { target: { value: 'Komatsu SA' } });
    fireEvent.change(screen.getByLabelText(/Person \/ Department Visiting/i), {
      target: { value: 'Control Room' },
    });
    fireEvent.change(screen.getByLabelText(/Reason for Visit/i), {
      target: { value: 'Audit' },
    });

    fireEvent.submit(screen.getByTestId('visitor-request-form'));

    await waitFor(() => {
      expect(
        screen.getByText(/Too many visitor pass requests\. Please try again shortly\./i)
      ).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('accepts a short password and lets the server validate it', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: 'Invalid credentials' }),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'short' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          body: JSON.stringify({ email: 'PC-12345', password: 'short' }),
        })
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('flags a malformed email on blur', () => {
    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText('username@arch-systems.io');
    fireEvent.change(emailInput, { target: { value: 'not-an-email@' } });
    fireEvent.blur(emailInput);

    expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
  });

  it('shows the server failure reason inline instead of a generic credential error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({
        error: 'Authentication service is temporarily unavailable. Please try again later.',
      }),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'testpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(
        screen.getByText(/Authentication service is temporarily unavailable/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid email\/employee ID or password/i)).not.toBeInTheDocument();
  });

  it('submits form and redirects on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'testpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'PC-12345', password: 'testpass' }),
        })
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('displays error when sign in fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: 'Invalid credentials' }),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Invalid credentials/i));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows network error when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'testpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error. Please try again.');
    });
  });

  it('disables button while submitting', async () => {
    let resolveFetch: (_value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchPromise = new Promise<{
      ok: boolean;
      json: () => Promise<unknown>;
    }>((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'testpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    // Button should show loading text and be disabled while loading
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /^Accessing your workspace\.\.\.$|^Access Arch Systems$|^Sign In$|^Signing in\.\.\.$/i,
        })
      ).toBeDisabled();
    });

    resolveFetch!({ ok: true, json: jest.fn().mockResolvedValue({}) });

    // After resolution, button should be enabled again
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /^Access Arch Systems$|^Sign In$|^Signing in\.\.\.$/i,
        })
      ).not.toBeDisabled();
    });
  });

  it('uses redirect query parameter when present', async () => {
    const { useSearchParams } = jest.requireMock('next/navigation');
    useSearchParams.mockReturnValue({
      get: jest.fn((key: string) => (key === 'redirect' ? '/dashboard' : null)),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
      target: { value: 'PC-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'testpass' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('toggles password visibility when the eye button is clicked', () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button to show password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

    // Click toggle button to hide password again
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
  });

  it('detects Caps Lock key down and up states', () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText('••••••••');

    // Press key with CapsLock active
    const keyDownEvent = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(keyDownEvent, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    });
    fireEvent(passwordInput, keyDownEvent);

    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();

    // Release key with CapsLock disabled
    const keyUpEvent = new KeyboardEvent('keyup', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(keyUpEvent, 'getModifierState', {
      value: (_key: string) => false,
    });
    fireEvent(passwordInput, keyUpEvent);

    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });

  it("rejects invalid page redirects (external or static files) and defaults to '/'", async () => {
    const { useSearchParams } = jest.requireMock('next/navigation');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const testRedirect = async (path: string, expectedTarget: string) => {
      useSearchParams.mockReturnValue({
        get: jest.fn((key: string) => (key === 'redirect' ? path : null)),
      });

      const { unmount } = render(<LoginForm />);

      fireEvent.change(screen.getByPlaceholderText('username@arch-systems.io'), {
        target: { value: 'PC-12345' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'testpass' },
      });
      fireEvent.submit(screen.getByTestId('login-form'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expectedTarget);
      });

      // clean up for next iteration
      unmount();
      jest.clearAllMocks();
      useRouter.mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
      });
    };

    // Test external domain redirect
    await testRedirect('https://malicious.com/dashboard', '/');
    // Test relative double-slash protocol bypass
    await testRedirect('//malicious.com/dashboard', '/');
    // Test static files (css, js, images)
    await testRedirect('/styles.css', '/');
    await testRedirect('/image.png', '/');
    // Test valid pages
    await testRedirect('/drilling/operations', '/drilling/operations');
  });
});
