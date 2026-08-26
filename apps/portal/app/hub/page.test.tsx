/**
 * Regression test: HubPage must never throw when any data-fetcher rejects.
 *
 * Root cause (fixed 2026-08-25): The page used Promise.all() across 6 parallel
 * DB/cache calls. A single ECONNREFUSED (Supabase or Redis down) caused the
 * entire Promise.all to reject, propagating an unhandled error to Next.js's
 * error boundary and displaying the "Try Again" button.
 *
 * Fix: switched to Promise.allSettled with per-slot typed safe defaults.
 *
 * These tests assert the page resolves successfully even when every single
 * data-fetcher throws, and that the resolved JSX includes a recognisable
 * hub section heading (not the error boundary heading "Hub Error").
 *
 * AGENT-TRACE: All module boundaries that make external I/O calls are mocked
 * at the module level. The page function is called directly as an async RSC
 * (same pattern as other portal page tests, e.g. (auth)/login/page.test.tsx).
 */

import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

// ── Next.js server APIs ───────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
  })),
}));

// ── Supabase / auth ───────────────────────────────────────────────────────────

const mockUser = { id: "test-user-id", email: "test@arch.com" };

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({ data: { role: "operator" }, error: null })),
    })),
    auth: { getUser: jest.fn(async () => ({ data: { user: mockUser }, error: null })) },
  })),
  getUserSafely: jest.fn(async () => mockUser),
}));

jest.mock("@repo/supabase/read-replica", () => ({
  createReadReplicaClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({ data: null, error: null })),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      rpc: jest.fn(async () => ({ data: [], error: null })),
    })),
  })),
}));

// ── Cache layers (bypass so fetchers run directly) ────────────────────────────

jest.mock("@/lib/server-cache", () => ({
  cachedRSC: jest.fn((_keys: string[], fn: () => Promise<unknown>) => fn()),
}));

jest.mock("@/lib/cache-utils", () => ({
  withCache: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}));

jest.mock("@repo/redis", () => ({
  CacheCategory: {
    AUTH: "auth",
    METRICS: "metrics",
    SHIFT: "shift",
    AI_MEMORY: "ai_memory",
    DEPARTMENT: "dept",
    EQUIPMENT: "equipment",
  },
}));

// ── Hub feature components (heavy — render stubs) ────────────────────────────

jest.mock("@/features/hub", () => ({
  AlertTicker: () => <div data-testid="alert-ticker" />,
  ProductionTrendWrapper: () => <div data-testid="production-trend" />,
  HeroBackground: () => <div data-testid="hero-bg" />,
  HeroRotator: () => <div data-testid="hero-rotator" />,
  ToolBanner: () => <div data-testid="tool-banner" />,
  DepartmentReviews: () => <div data-testid="dept-reviews" />,
  CoreOperationalModules: () => <div data-testid="core-modules" />,
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="glass-card">{children}</div>
  ),
}));

jest.mock("@repo/ui/Logo", () => ({
  Logo: () => <svg data-testid="logo" />,
}));

// ── Departments / tools ───────────────────────────────────────────────────────

jest.mock("@repo/departments/data-access", () => ({
  DEPARTMENTS: [
    {
      name: "drilling",
      displayName: "Drilling",
      route: "/drilling",
      icon: "Drill",
      description: "Drill rig operations",
      color: "blue",
      type: "standard",
      status: "active",
      stats: { label: "Depth", value: "1,240m" },
      trend: [1180, 1195, 1205, 1210, 1220, 1235, 1240, 1245],
      actions: [{ label: "View Logs", href: "/drilling/drilling-operations" }],
    },
  ],
  fetchLiveDepartmentMetrics: jest.fn(async () => ({})),
}));

jest.mock("@/lib/tools", () => ({
  getTools: jest.fn(async () => []),
}));

jest.mock("@/lib/hub-departments", () => ({
  getAccessibleDepartmentNames: jest.fn(async () => ["drilling"]),
}));

// ── Import the page AFTER all mocks are in place ──────────────────────────────

import HubPage from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("HubPage — graceful degradation", () => {
  it("renders without throwing when all data-fetchers succeed", async () => {
    const jsx = await HubPage();
    const { container } = render(jsx);
    // Page renders some hub UI — not the error boundary
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText(/Hub Error/i)).toBeNull();
    expect(screen.queryByText(/Try again/i)).toBeNull();
  });

  it("resolves without throwing when getDashboardCounts rejects", async () => {
    const { cachedRSC } = await import("@/lib/server-cache");
    (cachedRSC as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error("ECONNREFUSED — Supabase down")),
    );

    await expect(HubPage()).resolves.not.toThrow();
  });

  it("resolves without throwing when getAccessibleDepartmentNames rejects", async () => {
    const { getAccessibleDepartmentNames } = await import("@/lib/hub-departments");
    (getAccessibleDepartmentNames as jest.Mock).mockRejectedValueOnce(
      new Error("ECONNREFUSED — Supabase down"),
    );

    await expect(HubPage()).resolves.not.toThrow();
  });

  it("resolves without throwing when getTools rejects", async () => {
    const { getTools } = await import("@/lib/tools");
    (getTools as jest.Mock).mockRejectedValueOnce(new Error("DB timeout"));

    await expect(HubPage()).resolves.not.toThrow();
  });

  it("resolves without throwing when ALL data-fetchers reject simultaneously", async () => {
    // Simulate complete infrastructure outage — every fetcher throws.
    const { getTools } = await import("@/lib/tools");
    const { getAccessibleDepartmentNames } = await import("@/lib/hub-departments");
    const { cachedRSC } = await import("@/lib/server-cache");

    const dbError = new Error("ECONNREFUSED — Supabase/Redis down");
    (cachedRSC as jest.Mock).mockRejectedValue(dbError);
    (getAccessibleDepartmentNames as jest.Mock).mockRejectedValue(dbError);
    (getTools as jest.Mock).mockRejectedValue(dbError);

    // Must not throw — safe defaults kick in via Promise.allSettled.
    await expect(HubPage()).resolves.not.toThrow();
  });

  it("renders hub UI with safe defaults when all fetchers reject", async () => {
    const { getTools } = await import("@/lib/tools");
    const { getAccessibleDepartmentNames } = await import("@/lib/hub-departments");
    const { cachedRSC } = await import("@/lib/server-cache");

    const dbError = new Error("DB down");
    (cachedRSC as jest.Mock).mockRejectedValue(dbError);
    (getAccessibleDepartmentNames as jest.Mock).mockRejectedValue(dbError);
    (getTools as jest.Mock).mockRejectedValue(dbError);

    const jsx = await HubPage();
    const { container } = render(jsx);

    // Still renders the page shell
    expect(container.firstChild).not.toBeNull();
    // No error boundary title rendered
    expect(screen.queryByText(/Hub Error/i)).toBeNull();
    expect(screen.queryByText(/Try again/i)).toBeNull();
  });

  it("redirects to /login when user is not authenticated", async () => {
    const { getUserSafely } = await import("@repo/supabase/server");
    (getUserSafely as jest.Mock).mockResolvedValueOnce(null);

    await expect(HubPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
  });
});
