import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// Mock next/navigation
const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error(`NEXT_REDIRECT:${target}`);
  },
}));

// Mock cookies
const mockCookies = jest.fn();
jest.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

// Mock @repo/supabase/server
const mockGetUserSafely = jest.fn();
const mockCreateServerSupabaseClient = jest.fn();
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
  getUserSafely: (...args: any[]) => mockGetUserSafely(...args),
}));

// Mock LoginForm
jest.mock("@/features/auth/components/LoginForm", () => ({
  LoginForm: () => <div data-testid="mock-login-form" />,
}));

// Mock EveStatusBar
jest.mock("@repo/ui/EveStatusBar", () => ({
  EveStatusBar: () => <div data-testid="mock-eve-status-bar" />,
}));

// Mock GlassCard
jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, className, style }: any) => (
    <div data-testid="mock-glass-card" className={className} style={style}>
      {children}
    </div>
  ),
}));

// Mock utils
jest.mock("@repo/utils", () => ({
  getThreeShift: jest.fn(() => ({
    shift: "B",
    label: "Shift B",
    start: "14:00",
    end: "22:00",
  })),
}));

describe("LoginPage Server Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => []),
    });
  });

  it("renders login page successfully for unauthenticated user", async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByTestId("mock-login-form")).toBeInTheDocument();
    expect(screen.getByTestId("mock-eve-status-bar")).toBeInTheDocument();
  });

  it("renders the heading with the theme token class", async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    const heading = screen.getByRole("heading", { name: "Arch Systems" });
    expect(heading).toHaveClass("text-[var(--text-heading)]");
  });

  it("redirects authenticated user to /hub when no redirect param", async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: "sb-mock-auth-token.0", value: "token" }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockResolvedValue({ id: "user-123" });

    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT:/hub");
    expect(mockRedirect).toHaveBeenCalledWith("/hub");
  });

  it("redirects authenticated user to searchParams.redirect target", async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: "sb-mock-auth-token", value: "token" }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockResolvedValue({ id: "user-123" });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ redirect: "/production" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/production");
    expect(mockRedirect).toHaveBeenCalledWith("/production");
  });
});
