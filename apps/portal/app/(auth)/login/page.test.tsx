/**
 * LoginPage server component tests.
 *
 * The redirect/auth-cookie behaviour is unchanged and is the valuable part of
 * this suite — it guards the open-redirect checks. The presentation assertions
 * were updated for the "Core Log" redesign: the old macOS-window chrome (a
 * "Welcome Back" eyebrow and an "Arch Systems" heading) is gone.
 *
 * The form itself is the real LoginForm, whose own behaviour is covered by
 * LoginForm.test.tsx; here it is mocked so this suite stays a page test.
 */

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

describe("LoginPage Server Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => []),
    });
  });

  it("renders the sign-in panel for an unauthenticated user", async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    expect(
      screen.getByRole("heading", { name: "Sign in to your workstation" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-login-form")).toBeInTheDocument();
    expect(screen.getByTestId("mock-eve-status-bar")).toBeInTheDocument();
  });

  it("carries the login-card testid the visual suite targets", async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByTestId("login-card")).toBeInTheDocument();
  });

  it("keeps the measured section out of the accessibility tree", async () => {
    const pageElement = await LoginPage();
    const { container } = render(pageElement);

    // The depth scale is a schematic, not a claim about a real borehole, so the
    // values must sit inside an aria-hidden subtree and never be announced.
    const rail = container.querySelector(".slg-rail");
    expect(rail).not.toBeNull();
    expect(rail).toHaveAttribute("aria-hidden", "true");
    expect(rail).toHaveTextContent("100");
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
      LoginPage({ searchParams: Promise.resolve({ redirect: "/production" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/production");
    expect(mockRedirect).toHaveBeenCalledWith("/production");
  });

  it("refuses an off-site redirect target", async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: "sb-mock-auth-token", value: "token" }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockResolvedValue({ id: "user-123" });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ redirect: "//evil.example.com" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/hub");
    expect(mockRedirect).toHaveBeenCalledWith("/hub");
  });

  it("serves the form when the auth check fails transiently", async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: "sb-mock-auth-token", value: "token" }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockRejectedValue(new Error("fetch failed"));

    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByTestId("mock-login-form")).toBeInTheDocument();
    expect(screen.queryByText("System unavailable")).not.toBeInTheDocument();
  });

  it("shows the unavailable panel on a non-transient auth failure", async () => {
    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => [{ name: "sb-mock-auth-token", value: "token" }]),
    });
    mockCreateServerSupabaseClient.mockResolvedValue({});
    mockGetUserSafely.mockRejectedValue(new Error("Invalid API key"));

    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByRole("heading", { name: "System unavailable" })).toBeInTheDocument();
    expect(screen.queryByTestId("mock-login-form")).not.toBeInTheDocument();
  });
});
