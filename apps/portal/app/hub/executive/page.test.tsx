/**
 * Regression test: a failing get_production_summary RPC must be surfaced.
 *
 * Previously the executive page destructured only `{ data }` from the RPC,
 * discarded the error, and rendered every production KPI as zero — making an
 * outage indistinguishable from a real month with no production. The page now
 * logs the failure and renders an explicit alert with em-dash KPI values.
 */

import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
  })),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({})),
  getUserSafely: jest.fn(async () => ({ id: 'test-user-id' })),
}));

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  cachedRSC: jest.fn((_keys: string[], fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@repo/redis', () => ({
  CacheCategory: {
    AUTH: 'auth',
    METRICS: 'metrics',
    SHIFT: 'shift',
    AI_MEMORY: 'ai_memory',
    DEPARTMENT: 'dept',
    EQUIPMENT: 'equipment',
  },
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(async () => {}),
}));

jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@repo/ui/KPI', () => ({
  KPICard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="kpi">
      <span>{label}</span>
      <span>{String(value)}</span>
    </div>
  ),
  KPIGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/features/analytics/components/ExportButton', () => ({
  ExportButton: () => <button type="button">Export CSV</button>,
}));

jest.mock('@/features/analytics/components/PDFDownloadButton', () => ({
  PDFDownloadButton: () => <button type="button">Download PDF</button>,
}));

jest.mock('@/features/analytics/components/ProductionTrendChartWrapper', () => ({
  ProductionTrendChart: () => <div data-testid="production-trend-chart" />,
}));

import ExecutiveDashboardPage from './page';

const today = new Date().toISOString().split('T')[0]!;

const rpcError = {
  message: 'function public.get_production_summary(date,date) does not exist',
  code: 'PGRST202',
  details: null,
  hint: null,
};

interface RpcResponse {
  data: unknown;
  error: unknown;
}

function createReadReplicaMock(rpcResponse: RpcResponse) {
  return {
    rpc: jest.fn(async () => rpcResponse),
    from: jest.fn((table: string) => {
      let filtered = false;
      const builder: Record<string, jest.Mock> = {};
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn(() => {
        filtered = true;
        return builder;
      });
      builder.gte = jest.fn(() => builder);
      builder.is = jest.fn(async () => {
        if (table === 'machines') {
          return { data: null, count: filtered ? 8 : 10, error: null };
        }
        if (table === 'employees') {
          return { data: null, count: 12, error: null };
        }
        if (table === 'breakdowns') {
          return {
            data: [{ id: 'breakdown-1', status: 'active' }],
            count: null,
            error: null,
          };
        }
        return { data: [], count: null, error: null };
      });
      builder.single = jest.fn(async () => ({
        data: { role: 'manager' },
        error: null,
      }));
      return builder;
    }),
  };
}

async function renderPage(rpcResponse: RpcResponse) {
  const { createReadReplicaClient } = await import('@repo/supabase/read-replica');
  (createReadReplicaClient as jest.Mock).mockResolvedValue(createReadReplicaMock(rpcResponse));

  const jsx = await ExecutiveDashboardPage();
  return render(jsx);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExecutiveDashboardPage — production summary failure', () => {
  it('Given the summary RPC fails, When the page renders, Then the failure is surfaced instead of zero KPIs', async () => {
    const { logError } = await import('@/lib/errors/error-logger');

    await renderPage({ data: null, error: rpcError });

    expect(screen.getByRole('alert')).toHaveTextContent(/Production summary unavailable/i);

    const tonnageCard = screen.getByText('Total Tonnage').parentElement;
    expect(tonnageCard).toHaveTextContent('—');
    expect(tonnageCard).not.toHaveTextContent('0 t');

    expect(screen.queryByTestId('production-trend-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: rpcError.message }),
      expect.objectContaining({ context: 'hub.executive.get_production_summary' })
    );
  });

  it('Given the summary RPC succeeds, When the page renders, Then real KPIs and the chart are shown', async () => {
    await renderPage({
      data: [
        {
          log_date: today,
          actual_coal_tonnes: 100,
          actual_waste_tonnes: 200,
          total_fuel_litres: 50,
          total_hours_worked: 10,
          reconciliation_drift_pct: 1.5,
        },
      ],
      error: null,
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Total Tonnage').parentElement).toHaveTextContent('300 t');
    expect(screen.getByTestId('production-trend-chart')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });
});
