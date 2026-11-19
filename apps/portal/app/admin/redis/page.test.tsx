import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RedisManagerPage from './page';

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('RedisManagerPage (/admin/redis)', () => {
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

  it('fetches Redis observability & health metrics, supports key filtering/selection, and renders inline notices without alert', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/observability')) {
        return createJsonResponse({
          timestamp: '2026-11-19T14:30:00.000Z',
          overallSla24hPct: 99.95,
          totalKeys: 12450,
          opsPerSecond: 890,
          uptimeByTarget: {
            redis: {
              sla24hPct: 99.97,
              ticks: [
                { status: 'UP', latencyMs: 4 },
                { status: 'DEGRADED', latencyMs: 120 },
              ],
            },
          },
          goldenSignals: [
            { id: 'latency', alertState: 'NORMAL', thresholdLabel: 'SLO < 250ms' },
            { id: 'traffic', alertState: 'WARNING', thresholdLabel: 'Floor > 80%' },
            { id: 'errors', alertState: 'CRITICAL', thresholdLabel: 'Budget = 0' },
          ],
          redis: {
            stats: {
              hits: 900,
              misses: 100,
              l1Hits: 600,
              l1Misses: 50,
              l2Hits: 300,
              l2Misses: 50,
              l1Evictions: 120,
              redisErrors: 2,
              opsPerSecond: 890,
              totalKeys: 12450,
            },
            diagnostics: {
              connected: true,
              status: 'healthy',
              memoryUsedMb: 32.5,
            },
          },
        });
      }
      return createJsonResponse({
        mode: 'tcp',
        vectorSearch: { available: true },
        vectorIndexes: [
          {
            indexName: 'idx:mining_docs',
            exists: true,
            numDocs: 48,
            prefixes: ['doc:'],
          },
        ],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<RedisManagerPage />);

    await waitFor(() => {
      expect(screen.getByText('12,450')).toBeInTheDocument();
    });

    expect(screen.getByText('24h SLA: 99.97%')).toBeInTheDocument();
    expect(screen.getAllByText('890').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('allkeys-lru')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('idx:mining_docs')).toBeInTheDocument();
    expect(screen.getByText('FIRING')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search keys (*:pattern)');
    fireEvent.change(searchInput, { target: { value: 'telemetry' } });

    const keyList = screen.getByRole('list');
    expect(within(keyList).queryByText('shift_001_cache')).not.toBeInTheDocument();
    fireEvent.click(within(keyList).getByText('telemetry_dump_r1'));
    expect(screen.getByRole('heading', { name: 'telemetry_dump_r1' })).toBeInTheDocument();
    expect(screen.getByText(/Brakfontein Extension 3/i)).toBeInTheDocument();
    expect(screen.getByText(/"lastInspected": "2026-11-19T14:30:00.000Z"/)).toBeInTheDocument();

    const initialCallCount = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Key "telemetry_dump_r1" inspected and cluster telemetry refreshed'
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(screen.getByRole('status')).toHaveTextContent('RedisInsight (:5540)');
    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('handles Refresh Cluster and falls back cleanly when endpoints fail', async () => {
    const fetchMock = jest.fn(async () => createJsonResponse({ error: 'Offline' }, false, 503));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<RedisManagerPage />);

    const refreshButton = await screen.findByRole('button', { name: /Refresh Cluster/i });
    expect(screen.getByText(/FALLBACK: pgvector/i)).toBeInTheDocument();

    fireEvent.click(refreshButton);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/observability');
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
