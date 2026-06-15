import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: jest.fn(
    ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  ),
}));

jest.mock("@repo/ui/Input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

jest.mock("@repo/ui/AnimatedButton", () => ({
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
    type?: "button" | "submit" | "reset";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button
      type={type}
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

const { useRouter, useSearchParams } = jest.requireMock("next/navigation");

describe("LoginForm", () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders employee ID and password inputs", () => {
    render(<LoginForm />);

    expect(
      screen.getByPlaceholderText("Employee ID or email"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your password"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("nfc-icon")).toBeInTheDocument();

    const signInBtn = screen.getByRole("button", { name: /^Sign In$/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn.className).toContain("liquid-glass-button");
    expect(signInBtn.className).toContain("bg-[var(--color-action-primary)]");
    expect(signInBtn.className).toContain("text-white");
  });

  it("submits form and redirects on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
      target: { value: "PC-12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "testpass" },
    });
    fireEvent.submit(screen.getByTestId("login-form"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "PC-12345", password: "testpass" }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("displays error when sign in fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: "Invalid credentials" }),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
      target: { value: "PC-12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.submit(screen.getByTestId("login-form"));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows network error when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network failure"),
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
      target: { value: "PC-12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "testpass" },
    });
    fireEvent.submit(screen.getByTestId("login-form"));

    await waitFor(() => {
      expect(
        screen.getByText(/Network error\. Please try again\./i),
      ).toBeInTheDocument();
    });
  });

  it("disables button while submitting", async () => {
    let resolveFetch: (_value: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void;
    const fetchPromise = new Promise<{
      ok: boolean;
      json: () => Promise<unknown>;
    }>((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
      target: { value: "PC-12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "testpass" },
    });
    fireEvent.submit(screen.getByTestId("login-form"));

    // Button should show loading text and be disabled while loading
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Sign In$|^Signing in\.\.\.$/i }),
      ).toBeDisabled();
    });

    resolveFetch!({ ok: true, json: jest.fn().mockResolvedValue({}) });

    // After resolution, button should be enabled again
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Sign In$|^Signing in\.\.\.$/i }),
      ).not.toBeDisabled();
    });
  });

  it("uses redirect query parameter when present", async () => {
    const { useSearchParams } = jest.requireMock("next/navigation");
    useSearchParams.mockReturnValue({
      get: jest.fn((key: string) => (key === "redirect" ? "/dashboard" : null)),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
      target: { value: "PC-12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "testpass" },
    });
    fireEvent.submit(screen.getByTestId("login-form"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("toggles password visibility when the eye button is clicked", () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    expect(passwordInput).toHaveAttribute("type", "password");

    // Click toggle button to show password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");

    // Click toggle button to hide password again
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
  });

  it("detects Caps Lock key down and up states", () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText("Enter your password");

    // Press key with CapsLock active
    const keyDownEvent = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(keyDownEvent, "getModifierState", {
      value: (key: string) => key === "CapsLock",
    });
    fireEvent(passwordInput, keyDownEvent);

    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();

    // Release key with CapsLock disabled
    const keyUpEvent = new KeyboardEvent("keyup", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(keyUpEvent, "getModifierState", {
      value: (_key: string) => false,
    });
    fireEvent(passwordInput, keyUpEvent);

    expect(screen.queryByText("Caps Lock is on")).not.toBeInTheDocument();
  });

  it("rejects invalid page redirects (external or static files) and defaults to '/'", async () => {
    const { useSearchParams } = jest.requireMock("next/navigation");

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const testRedirect = async (path: string, expectedTarget: string) => {
      useSearchParams.mockReturnValue({
        get: jest.fn((key: string) => (key === "redirect" ? path : null)),
      });

      const { unmount } = render(<LoginForm />);

      fireEvent.change(screen.getByPlaceholderText("Employee ID or email"), {
        target: { value: "PC-12345" },
      });
      fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
        target: { value: "testpass" },
      });
      fireEvent.submit(screen.getByTestId("login-form"));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expectedTarget);
      });

      // clean up for next iteration
      unmount();
      jest.clearAllMocks();
    };

    // Test external domain redirect
    await testRedirect("https://malicious.com/dashboard", "/");
    // Test relative double-slash protocol bypass
    await testRedirect("//malicious.com/dashboard", "/");
    // Test static files (css, js, images)
    await testRedirect("/styles.css", "/");
    await testRedirect("/image.png", "/");
    // Test valid pages
    await testRedirect("/drilling/operations", "/drilling/operations");
  });
});
