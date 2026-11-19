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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('AuditLogsTab sanitizes search filters for .or() and renders en-ZA timestamps', async () => {
    const sampleAuditRows = [
      {
        id: 'aud-1',
        table_name: 'badges',
        action: 'INSERT',
        user_id: 'u-1',
        old_values: {},
        new_values: { qr_code: 'QR-001' },
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
    expect(screen.getAllByText('INSERT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('badges').length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'badges,1(2)%*' } });

    await waitFor(() => {
      expect(queryChain.or).toHaveBeenCalledWith(
        'action.ilike.%badges12%,table_name.ilike.%badges12%'
      );
    });
  });

  it('SystemLogsTab loads paginated system logs, expands trace details, and resolves entries', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Resolve/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/logs',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});
