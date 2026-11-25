import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DETAILED_LIVE_COUNT_TABLES } from '../department-database-catalog';
import DatabaseReportsPage from './page';

const mockFetchDatabaseTableCounts = jest.fn();
const mockFetchSupabaseClusterTelemetry = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('../department-database-catalog', () => {
  const actual = jest.requireActual('../department-database-catalog');
  return {
    ...actual,
    fetchDatabaseTableCounts: () => mockFetchDatabaseTableCounts(),
  };
});

jest.mock('../supabase-telemetry', () => ({
  fetchSupabaseClusterTelemetry: () => mockFetchSupabaseClusterTelemetry(),
}));

describe('DatabaseReportsPage (/database/reports)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders department readiness audit table, slow queries, and pg_cron jobs in live mode', async () => {
    const rowCounts: Record<string, number> = {};
    for (const tbl of DETAILED_LIVE_COUNT_TABLES) {
      rowCounts[tbl] = 12;
    }

    mockFetchDatabaseTableCounts.mockResolvedValueOnce({
      rowCounts,
      isLiveConnected: true,
      totalLiveRows: 624,
    });
    mockFetchSupabaseClusterTelemetry.mockResolvedValueOnce({
      bufferCacheHitPct: 99.94,
      storageBuckets: ['documents', 'personnel-photos'],
      cronJobs: [
        {
          jobid: 1,
          jobname: 'refresh-dept-production-summary',
          schedule: '*/15 * * * *',
          command: 'SELECT public.refresh_dept_production_summary_smart()',
          isActive: true,
          lastRunStatus: 'succeeded',
        },
      ],
      slowQueries: [
        {
          queryPreview: 'SELECT * FROM public.machine_operations WHERE operation_date = $1',
          calls: 150,
          meanExecTimeMs: 4.25,
          totalExecTimeMs: 637.5,
        },
      ],
    });

    const jsx = await DatabaseReportsPage();
    render(jsx);

    expect(
      screen.getByText('Database Integrity & Cross-Department Readiness Report')
    ).toBeInTheDocument();
    expect(screen.getByTestId('department-verification-audit-table')).toBeInTheDocument();
    expect(screen.getByTestId('slow-queries-report-card')).toBeInTheDocument();
    expect(
      screen.getByText('SELECT * FROM public.machine_operations WHERE operation_date = $1')
    ).toBeInTheDocument();
    expect(screen.getByText('refresh-dept-production-summary')).toBeInTheDocument();
  });

  it('degrades cleanly to Standby mode when database telemetry is unavailable', async () => {
    mockFetchDatabaseTableCounts.mockResolvedValueOnce({
      rowCounts: {},
      isLiveConnected: false,
      totalLiveRows: 0,
    });
    mockFetchSupabaseClusterTelemetry.mockResolvedValueOnce({
      bufferCacheHitPct: 99.9,
      storageBuckets: ['documents'],
      cronJobs: [],
      slowQueries: [],
    });

    const jsx = await DatabaseReportsPage();
    render(jsx);

    expect(screen.getByText('Supabase Standby')).toBeInTheDocument();
    expect(screen.getByText(/No elevated slow queries reported/i)).toBeInTheDocument();
  });
});
