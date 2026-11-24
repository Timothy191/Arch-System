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

function buildAuditQuery(rows: unknown[], count = rows.length) {
  const promise = Promise.resolve({ data: rows, count, error: null });
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
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

  it('AuditLogsTab sanitizes search filters, expands JSON diff, and exports CSV without re-fetch loops', async () => {
    const sampleAuditRows = [
      {
        id: 'aud-1',
        table_name: 'badges',
        action: 'UPDATE',
        user_id: 'u-1',
        old_values: { active: true },
        new_values: { active: false, qr_code: 'QR-001' },
        created_at: '2026-11-19T08:30:00Z',
        employees: { full_name: 'T. Mokoena' },
      },
    ];
    const queryChain = buildAuditQuery(sampleAuditRows, 1);

    mockCreateBrowserSupabase.mockReturnValue({
      from: jest.fn(() => queryChain),
    } as never);

    render(<AuditLogsTab />);

    await waitFor(() => {
      expect(screen.getByText('T. Mokoena')).toBeInTheDocument();
    });
    expect(screen.getAllByText('UPDATE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('badges').length).toBeGreaterThan(0);
    expect(mockCreateBrowserSupabase).toHaveBeenCalledTimes(1);

    // Click row to expand Old Values / New Values JSON diff
    fireEvent.click(screen.getByText('T. Mokoena'));
    expect(screen.getByTestId('audit-diff-aud-1')).toBeInTheDocument();
    expect(screen.getByText('Old Values')).toBeInTheDocument();
    expect(screen.getByText('New Values')).toBeInTheDocument();

    // Wire Export button -> creates CSV blob
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

  it('SystemLogsTab loads logs, expands traces, supports bulk resolve & CSV export', async () => {
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

    fireEvent.click(screen.getByText('SCADA socket reconnecting'));
    expect(screen.getByText(/Trace ID: trace-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: req-456/i)).toBeInTheDocument();

    // Select row -> bulk toolbar appears -> bulk Resolve Selected
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
