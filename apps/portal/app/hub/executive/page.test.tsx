/**
 * Executive dashboard — material ledger presentation contract.
 *
 * The redesigned page leads with a "Material ledger" hero: the month-to-date
 * tonnage figure with a proportional coal/waste split bar whose segment widths
 * ARE the strip-ratio composition. These tests pin that contract:
 *
 * 1. The hero renders the MTD tonnage and proportional segment widths from
 *    the summary rows (coal 1400 t / waste 600 t → 70% / 30%).
 * 2. Rows outside the month-to-date window still feed the chart/export
 *    payloads (3 rows exported, MTD totals untouched).
 * 3. The role gate passes admins through and redirects everyone else.
 * 4. A stable drift level renders no drift warning banner.
 *
 * AGENT-TRACE: All module boundaries that make external I/O calls are mocked
 * at the module level. The page function is called directly as an async RSC
 * (same pattern as hub/page.test.tsx).
 */

import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

// ── Fixed clock (page derives today / monthStart / thirtyDaysAgo) ─────────────
// Fake Date only; keep timers real so RTL/microtasks behave normally.

const FIXED_NOW = new Date("2026-09-17T10:00:00.000Z");

jest.useFakeTimers({
  now: FIXED_NOW,
  doNotFake: [
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "setImmediate",
    "clearImmediate",
    "queueMicrotask",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "performance",
  ],
});

afterAll(() => {
  jest.useRealTimers();
});

// ── Production summary rows (RPC get_production_summary) ──────────────────────

const summaryRows = [
  {
    log_date: "2026-09-15",
    actual_coal_tonnes: 700,
    actual_waste_tonnes: 300,
    total_fuel_litres: 2000,
    total_hours_worked: 100,
    reconciliation_drift_pct: 0.5,
  },
  {
    log_date: "2026-09-16",
    actual_coal_tonnes: 700,
    actual_waste_tonnes: 300,
    total_fuel_litres: 2000,
    total_hours_worked: 100,
    reconciliation_drift_pct: 1.5,
  },
  // Outside the month-to-date window — feeds the 30-day chart/exports only.
  {
    log_date: "2026-08-25",
    actual_coal_tonnes: 500,
    actual_waste_tonnes: 100,
    total_fuel_litres: 800,
    total_hours_worked: 40,
    reconciliation_drift_pct: 2,
  },
];

// ── Next.js server APIs ───────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
  })),
}));

// ── Supabase / auth + role gate (mutable for the non-admin case) ──────────────

const mockUser = { id: "test-user-id", email: "test@arch.com" };

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(async () => ({})),
  getUserSafely: jest.fn(async () => mockUser),
}));

jest.mock("@repo/supabase/read-replica", () => {
  const roleRef = { role: "admin" };
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      gte: () => builder,
      single: () => Promise.resolve({ data: { role: roleRef.role }, error: null }),
      then: (resolve: (_v: unknown) => void) => resolve({ count: 42, data: [], error: null }),
    };
    return builder;
  };
  const makeDb = () => ({
    rpc: () => Promise.resolve({ data: summaryRows, error: null }),
    from: () => makeBuilder(),
  });
  return {
    createReadReplicaClient: Object.assign(async () => makeDb(), {
      __setRole: (role: string) => {
        roleRef.role = role;
      },
      __roleRef: roleRef,
    }),
  };
});

// ── Cache layers (bypass so fetchers run directly) ────────────────────────────

jest.mock("@/lib/server-cache", () => ({
  cachedRSC: jest.fn((_keys: string[], fn: () => Promise<unknown>) => fn()),
}));

jest.mock("@/lib/cache-utils", () => ({
  withCache: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}));

jest.mock("@repo/redis", () => ({
  CacheCategory: { METRICS: "metrics" },
}));

// ── Heavy feature components (render stubs) ───────────────────────────────────

jest.mock("@/features/analytics/components/ExportButton", () => ({
  ExportButton: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="export-button" data-rows={String(rows.length)} />
  ),
}));

jest.mock("@/features/analytics/components/PDFDownloadButton", () => ({
  PDFDownloadButton: () => <div data-testid="pdf-button" />,
}));

jest.mock("@/features/analytics/components/ProductionTrendChartWrapper", () => ({
  ProductionTrendChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="trend-chart" data-points={String(data.length)} />
  ),
}));

jest.mock("@repo/ui/GlassCard", () => ({
  GlassCard: ({ children, ...rest }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="glass-card" {...rest}>
      {children}
    </div>
  ),
}));

jest.mock("@repo/ui/KPI", () => ({
  KPICard: ({ label, value, sub }: { label: string; value: unknown; sub?: string }) => (
    <div data-testid="kpi-card">
      {label}: {String(value)}
      {sub ? ` — ${sub}` : ""}
    </div>
  ),
  KPIGrid: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="kpi-grid">{children}</div>
  ),
}));

// ── The page under test ───────────────────────────────────────────────────────

import { createReadReplicaClient } from "@repo/supabase/read-replica";
import ExecutiveDashboardPage from "./page";

const mockedRedirect = redirect as jest.Mock;
const roleGate = createReadReplicaClient as unknown as {
  __setRole: (_role: string) => void;
};

describe("ExecutiveDashboardPage", () => {
  beforeEach(() => {
    mockedRedirect.mockClear();
    roleGate.__setRole("admin");
  });

  it("renders the material ledger hero with MTD tonnage and proportional split", async () => {
    render(await ExecutiveDashboardPage());

    const ledger = screen.getByTestId("tonnage-ledger");
    expect(ledger).toBeInTheDocument();
    expect(ledger.textContent).toContain("2,000");

    // Strip ratio: coal 1400 t of 2000 t → 70%, waste 600 t → 30%
    const coal = screen.getByTestId("ledger-coal-segment");
    const waste = screen.getByTestId("ledger-waste-segment");
    expect(coal).toHaveStyle({ width: "70%" });
    expect(waste).toHaveStyle({ width: "30%" });

    // Segment figures rendered in the ledger columns
    expect(ledger.textContent).toContain("1,400");
    expect(ledger.textContent).toContain("600");
  });

  it("keeps out-of-window rows in the chart/export payloads while MTD stays clean", async () => {
    render(await ExecutiveDashboardPage());

    // 3 summary rows feed the trend chart and the CSV export
    expect(screen.getByTestId("trend-chart")).toHaveAttribute("data-points", "3");
    expect(screen.getByTestId("export-button")).toHaveAttribute("data-rows", "3");
  });

  it("shows the reconciliation status and omits the warning banner when drift is stable", async () => {
    render(await ExecutiveDashboardPage());

    // avg drift (1.0%) is below the 5% minor threshold → "Optimal" chip
    expect(screen.getByTestId("drift-chip").textContent).toContain("Optimal");
    expect(screen.queryByText(/operational drift warning/i)).not.toBeInTheDocument();
  });

  it("admits admins and redirects other roles", async () => {
    render(await ExecutiveDashboardPage());
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("redirects non-admin roles away from the executive hub", async () => {
    roleGate.__setRole("operator");
    render(await ExecutiveDashboardPage());
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });
});
