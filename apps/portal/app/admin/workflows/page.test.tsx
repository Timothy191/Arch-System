import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowsPage from './WorkflowsConsoleClient';

const DEPT_ID = '11111111-1111-4111-a111-111111111111';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [{ id: DEPT_ID, name: 'control-room', display_name: 'Control Room' }],
          }),
        }),
      }),
    })),
  })),
}));

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

  it('renders live observability metrics and inspects real Webhook Delivery Logs & Metrics', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/webhooks') {
        return createJsonResponse({
          webhooks: [
            {
              id: 'wh-1',
              url: 'https://hooks.plantcor.example/shift-closeout-sync',
              description: 'Shift Closeout Hook',
              event_types: ['daily_log.created'],
              active: true,
            },
          ],
        });
      }
      if (url === '/api/webhooks/wh-1/metrics') {
        return createJsonResponse({
          total: 10,
          successful: 9,
          failed: 1,
          retried: 1,
          successRate: 90,
          lastDeliveredAt: '2026-11-19T12:00:00.000Z',
        });
      }
      if (url === '/api/webhooks/wh-1/logs') {
        return createJsonResponse({
          logs: [
            {
              id: 'log-1',
              event_type: 'daily_log.created',
              response_status: 200,
              retry_count: 0,
              success: true,
              error_message: null,
              created_at: '2026-11-19T12:00:00.000Z',
            },
          ],
        });
      }
      return createJsonResponse({
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
      });
    });
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
    const inspector = await screen.findByTestId('webhook-delivery-inspector');
    expect(inspector).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Delivery Rate: 90%')).toBeInTheDocument();
      expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    });
    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Close Inspector/i }));
    expect(screen.queryByTestId('webhook-delivery-inspector')).not.toBeInTheDocument();
  });

  it('opens Provision Trigger dialog requiring department and validated HTTPS URL before POST /api/webhooks', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/webhooks' && init?.method === 'POST') {
        return createJsonResponse({ webhook: { id: 'wh-created' } }, true, 201);
      }
      if (url === '/api/webhooks') {
        return createJsonResponse({ webhooks: [] });
      }
      return createJsonResponse({
        timestamp: '2026-11-19T12:00:00.000Z',
        overallSla24hPct: 100,
        workflows: [],
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<WorkflowsPage />);

    const provisionBtn = await screen.findByRole('button', { name: /Provision Trigger/i });
    fireEvent.click(provisionBtn);

    expect(screen.getByText('Provision Webhook Trigger')).toBeInTheDocument();

    // Rejects fictional .internal URL client-side before POSTing
    const urlInput = screen.getByLabelText(/HTTPS Target Webhook URL/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://n8n.arch-system.internal/webhook/test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Webhook Trigger/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/disallowed host/i);

    // Accepts valid HTTPS URL + real department_id
    fireEvent.change(urlInput, {
      target: { value: 'https://n8n.plantcor.example/webhook/shift-closeout' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Webhook Trigger/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/webhooks',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(DEPT_ID),
        })
      );
    });
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

    const webhookLinks = screen.getAllByRole('link', { name: /Webhook/i });
    expect(webhookLinks.length).toBeGreaterThanOrEqual(1);
    expect(webhookLinks[0]).toHaveAttribute('href', '/admin?tab=webhooks');
  });

  it('refreshes telemetry via /api/admin/observability when clicking Refresh Telemetry and handles errors inline', async () => {
    let observabilityCallCount = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/webhooks')) {
        return createJsonResponse({ webhooks: [] });
      }
      observabilityCallCount += 1;
      if (observabilityCallCount === 1) {
        return createJsonResponse({
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
        });
      }
      if (observabilityCallCount === 2) {
        return createJsonResponse({
          overallSla24hPct: 99.98,
          workflows: [
            {
              jobId: 'scada-poller',
              count: 10,
              errors: 0,
              lastDurationMs: 42,
            },
          ],
        });
      }
      return createJsonResponse({ error: 'Upstream down' }, false, 500);
    });

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

  it('renders critical webhooks & workflows on the left and updates the n8n flow visual on selection', async () => {
    globalThis.fetch = jest.fn(async () =>
      createJsonResponse({
        timestamp: '2026-11-19T12:00:00.000Z',
        overallSla24hPct: 100,
        workflows: [],
      })
    ) as unknown as typeof fetch;

    render(<WorkflowsPage />);

    const panel = await screen.findByTestId('critical-workflows-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText('Shift Closeout Hook')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /SCADA Telemetry Anomaly Escalation/i }));
    expect(screen.getByText('SCADA CDC Stream')).toBeInTheDocument();
    expect(screen.getByText('Engineering Ticket')).toBeInTheDocument();
  });
});
