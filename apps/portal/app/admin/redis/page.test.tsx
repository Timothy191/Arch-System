import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RedisManagerPage from './RedisManagerClient';

function createJsonResponse(
  body: unknown,
  options?: { readonly ok?: boolean; readonly status?: number }
): Response {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
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

  it('maps real RedisHealthDiagnostics, avoids duplicate fetchStats on key selection, and deletes non-protected keys with confirmation', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/redis/inspect')) {
        if (init?.method === 'DELETE') {
          return createJsonResponse({
            success: true,
            key: 'telemetry_dump_r1',
            deleted: true,
            deletedCount: 1,
          });
        }
        return createJsonResponse({
          connected: true,
          keys: ['shift_001_cache', 'telemetry_dump_r1'],
          inspected: {
            key: 'telemetry_dump_r1',
            type: 'hash',
            ttlSeconds: 3600,
            value: { pitSection: 'Brakfontein Extension 3' },
          },
        });
      }
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
              usedMemoryBytes: 34_078_720,
              maxmemoryBytes: 67_108_864,
              memFragmentationRatio: 1.08,
              maxmemoryPolicy: 'allkeys-lru',
              evictedKeysTotal: 7,
              keyspaceHitsTotal: 900,
              keyspaceMissesTotal: 100,
              hitRateRatio: 0.9,
              replicationRole: 'master',
              connectedSlaves: 1,
              slowlogCount: 3,
            },
          },
        });
      }
      return createJsonResponse({
        mode: 'tcp',
        engine: 'redis-7.4.1',
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

    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/L1_EVICTIONS/i)).not.toBeInTheDocument();
    expect(screen.getByText('24h SLA: 99.97%')).toBeInTheDocument();
    expect(screen.getAllByText('890').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('allkeys-lru')).toBeInTheDocument();
    expect(screen.getByText('1.08x')).toBeInTheDocument();
    expect(screen.getByText('master')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('idx:mining_docs')).toBeInTheDocument();
    expect(screen.getByText('FIRING')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    const observabilityCallsBeforeSelect = fetchMock.mock.calls.filter(([reqUrl]) =>
      String(reqUrl).includes('/api/admin/observability')
    ).length;

    const searchInput = screen.getByPlaceholderText('Search keys (*:pattern)');
    fireEvent.change(searchInput, { target: { value: 'telemetry' } });

    const keyList = screen.getByRole('list');
    expect(within(keyList).queryByText('shift_001_cache')).not.toBeInTheDocument();
    fireEvent.click(within(keyList).getByText('telemetry_dump_r1'));
    expect(screen.getByRole('heading', { name: 'telemetry_dump_r1' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Brakfontein Extension 3/i)).toBeInTheDocument();
    });

    // Selecting a key must NOT re-trigger fetchStats (/api/admin/observability)
    const observabilityCallsAfterSelect = fetchMock.mock.calls.filter(([reqUrl]) =>
      String(reqUrl).includes('/api/admin/observability')
    ).length;
    expect(observabilityCallsAfterSelect).toBe(observabilityCallsBeforeSelect);

    const callsBeforeInspect = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeInspect);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Inspected live Redis key "telemetry_dump_r1" and refreshed cluster telemetry.'
    );

    // Delete flow opens confirmation dialog and executes DELETE /api/admin/redis/inspect
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Confirm Redis key deletion');
    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Deleted Redis key "telemetry_dump_r1" and recorded admin audit log.'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('displays honest Not reported / No samples yet states when Upstash REST omits INFO diagnostics or endpoints fail', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({ error: 'Offline' }, { ok: false, status: 503 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<RedisManagerPage />);

    const refreshButton = await screen.findByRole('button', { name: /Refresh Cluster/i });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
    expect(screen.queryByText('48.6 MB')).not.toBeInTheDocument();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No samples yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/FALLBACK: pgvector/i)).toBeInTheDocument();

    fireEvent.click(refreshButton);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/observability');
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
