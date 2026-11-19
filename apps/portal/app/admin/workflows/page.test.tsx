import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowsPage from './page';

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('WorkflowsPage (/admin/workflows)', () => {
  const originalFetch = globalThis.fetch;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    alertSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('renders live /api/admin/observability workflow metrics, selects jobs, and shows inline feedback without window.alert', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        timestamp: '2026-11-19T12:00:00.000Z',
        overallSla24hPct: 99.92,
        workflows: [
          {
            jobId: 'shift-closeout-sync',
            count: 20,
            errors: 1,
            lastDurationMs: 145,
          },
          {
            jobId: 'daily-pdf-report',
            count: 5,
            errors: 0,
            lastDurationMs: 320,
          },
        ],
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<WorkflowsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('shift-closeout-sync').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText(/24h SLA: 99.92%/i)).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('96.0%')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('145ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^daily-pdf-report/i }));
    expect(screen.getByText('320ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inspect daily-pdf-report/i }));
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('daily-pdf-report');
    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Job Details/i }));
    expect(screen.getByRole('status')).toHaveTextContent('server workflow schedules');

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an honest empty state with /admin?tab=webhooks link when zero background jobs have run', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        timestamp: '2026-11-19T12:00:00.000Z',
        overallSla24hPct: 100,
        workflows: [],
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<WorkflowsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No background jobs executed yet in this runtime process/i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('Data Pipeline Monitor')).not.toBeInTheDocument();
    const webhookLinks = screen.getAllByRole('link', { name: /Webhook/i });
    expect(webhookLinks.length).toBeGreaterThanOrEqual(1);
    expect(webhookLinks[0]).toHaveAttribute('href', '/admin?tab=webhooks');
  });

  it('refreshes telemetry via /api/admin/observability when clicking Refresh Telemetry and handles errors inline', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          uptime: { sla24h: 99.85 },
          workflows: {
            jobs: [
              {
                jobId: 'scada-poller',
                count: 0,
                errors: 0,
                lastDurationMs: 0,
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          overallSla24hPct: 99.98,
          workflows: [
            {
              jobId: 'scada-poller',
              count: 10,
              errors: 0,
              lastDurationMs: 42,
            },
          ],
        })
      )
      .mockResolvedValueOnce(createJsonResponse({ error: 'Upstream down' }, false, 500));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<WorkflowsPage />);

    await waitFor(() => {
      expect(screen.getByText(/24h SLA: 99.85%/i)).toBeInTheDocument();
    });
    expect(screen.getByText('idle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Refresh Telemetry/i }));

    await waitFor(() => {
      expect(screen.getByText(/24h SLA: 99.98%/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Telemetry refreshed');
    expect(screen.getByText('42ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Refresh Telemetry/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Unable to reach /api/admin/observability'
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
