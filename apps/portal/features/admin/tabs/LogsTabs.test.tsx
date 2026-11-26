import '@testing-library/jest-dom';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuditLogsTab } from './AuditLogsTab';
import { SystemLogsTab } from './SystemLogsTab';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockCreateBrowserSupabase = jest.mocked(createBrowserSupabaseClient);

function buildAuditQuery(
  rows: unknown[],
  options: { count?: number; error?: { message: string } | null } = {}
) {
  const count = options.count ?? rows.length;
  const error = options.error ?? null;
  const promise = Promise.resolve({
    data: error ? null : rows,
    count: error ? null : count,
    error,
  });
  const chain: Record<string, jest.Mock | unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return chain;
}

describe('Admin Logs Tabs (AuditLogsTab & SystemLogsTab)', () => {
  const originalFetch = global.fetch;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:mock-csv');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('AuditLogsTab bounds filter query, uses old_data/new_data/performed_by, expands diff, and exports CSV', async () => {
    const sampleAuditRows = [
      {
        id: 'aud-1',
        table_name: 'badges',
        action: 'update',
        performed_by: 'emp-99',
        old_data: { active: true },
        new_data: { active: false, qr_code: 'QR-001' },
        created_at: '2026-11-19T08:30:00Z',
        employees: { full_name: 'T. Mokoena' },
      },
    ];
    const queryChain = buildAuditQuery(sampleAuditRows, { count: 1 });

    mockCreateBrowserSupabase.mockReturnValue({
      from: jest.fn(() => queryChain),
    } as never);

    render(<AuditLogsTab />);

    await waitFor(() => {
      expect(screen.getByText('T. Mokoena')).toBeInTheDocument();
    });
    expect(queryChain.limit).toHaveBeenCalledWith(500);
    expect(screen.getAllByText('update').length).toBeGreaterThan(0);
    expect(screen.getAllByText('badges').length).toBeGreaterThan(0);
    expect(screen.getByText(/QR-001/)).toBeInTheDocument();
    expect(mockCreateBrowserSupabase).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('T. Mokoena'));
    expect(screen.getByTestId('audit-diff-aud-1')).toBeInTheDocument();
    expect(screen.getByText('Old Data')).toBeInTheDocument();
    expect(screen.getByText('New Data')).toBeInTheDocument();

    const anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-csv');
    anchorClickSpy.mockRestore();

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'badges,1(2)%*' } });

    await waitFor(() => {
      expect(queryChain.or).toHaveBeenCalledWith(
        'action.ilike.%badges12%,table_name.ilike.%badges12%'
      );
    });
  });

  it('AuditLogsTab surfaces query errors cleanly via alert banner', async () => {
    const failingChain = buildAuditQuery([], {
      error: { message: 'RLS policy denied audit_logs query' },
    });
    mockCreateBrowserSupabase.mockReturnValue({
      from: jest.fn(() => failingChain),
    } as never);

    render(<AuditLogsTab />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('RLS policy denied audit_logs query');
    });
  });

  it('SystemLogsTab loads logs, filters by category, expands traces, and supports bulk resolve & CSV export', async () => {
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'sys-1',
              level: 'error',
              source: 'api',
              category: 'telemetry',
              message: 'SCADA socket reconnecting',
              stack: 'Error: timeout',
              context: { retry: 1 },
              url: '/api/scada/tags',
              method: 'GET',
              trace_id: 'trace-123',
              request_id: 'req-456',
              employee_id: null,
              created_at: '2026-11-19T09:00:00Z',
              resolved: false,
              employees: { full_name: 'Control Room Bot' },
            },
          ],
          pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
        }),
      } as Response;
    });
    global.fetch = fetchMock as typeof global.fetch;

    render(<SystemLogsTab />);

    await waitFor(() => {
      expect(screen.getByText('SCADA socket reconnecting')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText('Filter by category');
    fireEvent.change(categorySelect, { target: { value: 'telemetry' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('category=telemetry'));
      expect(screen.getByText('SCADA socket reconnecting')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('SCADA socket reconnecting'));
    expect(screen.getByText(/Trace ID: trace-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: req-456/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select log sys-1'));
    expect(screen.getByTestId('system-logs-bulk-toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resolve Selected \(1\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/logs',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ ids: ['sys-1'], resolved: true }),
        })
      );
    });

    const anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    anchorClickSpy.mockRestore();
  });
});
