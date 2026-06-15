import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// Mock cookies
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
  })),
}));

// Mock @repo/supabase/server
jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
  getUserSafely: jest.fn(),
}));

// Mock LoginForm
jest.mock("./LoginForm", () => ({
  LoginForm: () => <div data-testid="mock-login-form" />,
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
  it("renders login page successfully", async () => {
    const pageElement = await LoginPage();
    render(pageElement);

    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByTestId("mock-login-form")).toBeInTheDocument();
  });
});
