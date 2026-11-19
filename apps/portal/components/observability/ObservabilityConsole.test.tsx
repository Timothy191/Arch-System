import '@testing-library/jest-dom';
import type { ObservabilityCiResponse, ObservabilitySummaryResponse } from '@repo/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ObservabilityConsole } from './ObservabilityConsole';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function buildSummaryResponse(withDashboards = true): ObservabilitySummaryResponse {
  return {
    generatedAt: '2026-11-19T12:00:00.000Z',
    deploymentTarget: 'vercel',
    services: [
      {
        id: 'otel-collector',
        label: 'OTel Collector',
        mode: 'live',
        latencyMs: 14,
        endpointConfigured: true,
        detail: 'OTLP gRPC receiver healthy.',
      },
      {
        id: 'prometheus',
        label: 'Prometheus TSDB',
        mode: 'fallback',
        latencyMs: null,
        endpointConfigured: false,
        detail: 'Using in-process metrics.',
      },
      {
        id: 'grafana',
        label: 'Grafana Native Layer',
        mode: 'unconfigured',
        latencyMs: null,
        endpointConfigured: false,
        detail: 'Set GRAFANA_URL to enable.',
      },
    ],
    metrics: [
      {
        id: 'cache_hits_l1',
        label: 'L1 Cache Hits',
        query: 'arch_cache_l1_hits_total',
        value: 420,
        unit: 'hits',
        source: 'live',
      },
      {
        id: 'event_loop_p95',
        label: 'Event Loop p95',
        query: 'nodejs_event_loop_lag_p95_seconds',
        value: null,
        unit: 'ms',
        source: 'fallback',
      },
    ],
    dashboards: withDashboards
      ? [
          {
            uid: 'arch-main',
            title: 'Arch Portal Golden Signals',
            folderTitle: 'Portal',
            embedUrl: 'https://grafana.arch.example.com/d/arch-main?theme=light&kiosk',
          },
        ]
      : [],
    cacheSnapshot: {
      hits: 500,
      misses: 20,
      l1Hits: 420,
      l2Hits: 80,
      avgLatencyMs: 2.1,
      p95LatencyMs: 6.4,
    },
  };
}

function buildCiResponse(withPipelines = true): ObservabilityCiResponse {
  return {
    generatedAt: '2026-11-19T12:00:00.000Z',
    mode: withPipelines ? 'live' : 'fallback',
    pipelines: withPipelines
      ? [
          {
            id: 101,
            number: 12,
            branch: 'main',
            commitSha: '226e3968',
            message: 'feat: native observability telemetry',
            status: 'success',
            source: 'woodpecker',
            startedAt: '2026-11-19T11:30:00.000Z',
            url: 'https://ci.arch.example.com/101',
          },
          {
            id: 102,
            number: 13,
            branch: 'fix/redis-guard',
            commitSha: '991a4412',
            message: 'fix: circuit breaker fallback',
            status: 'failure',
            source: 'woodpecker',
            startedAt: '2026-11-19T11:45:00.000Z',
            url: null,
          },
          {
            id: 103,
            number: 14,
            branch: 'chore/deps',
            commitSha: '77bb1100',
            message: 'chore: verify lockfile',
            status: 'pending',
            source: 'github-status',
            startedAt: null,
            url: null,
          },
        ]
      : [],
  };
}

describe('ObservabilityConsole', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders services, golden signals, Grafana dashboard iframe, CI pipelines, and refreshes telemetry', async () => {
    let fetchCycle = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/observability/summary')) {
        return createJsonResponse(buildSummaryResponse(fetchCycle === 0));
      }
      return createJsonResponse(buildCiResponse(fetchCycle === 0));
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ObservabilityConsole />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('OTel Collector')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Live Cluster').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Native Fallback').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Unconfigured')).toBeInTheDocument();
    expect(screen.getByText('14 ms')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('arch_cache_l1_hits_total')).toBeInTheDocument();

    const grafanaTab = screen.getByRole('tab', { name: /Grafana Native Layer/i });
    fireEvent.mouseDown(grafanaTab);
    fireEvent.click(grafanaTab);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Arch Portal Golden Signals/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Arch Portal Golden Signals/i }));
    const iframe = screen.getByTitle('Grafana Light-Mode Dashboard');
    expect(iframe).toHaveAttribute(
      'src',
      'https://grafana.arch.example.com/d/arch-main?theme=light&kiosk'
    );

    const ciTab = screen.getByRole('tab', { name: /Woodpecker & CI Gates/i });
    fireEvent.mouseDown(ciTab);
    fireEvent.click(ciTab);

    await waitFor(() => {
      expect(screen.getByText('Woodpecker CI Live')).toBeInTheDocument();
    });
    expect(screen.getByText('feat: native observability telemetry')).toBeInTheDocument();
    expect(screen.getByText('fix: circuit breaker fallback')).toBeInTheDocument();
    expect(screen.getByText('chore: verify lockfile')).toBeInTheDocument();

    fetchCycle = 1;
    fireEvent.click(screen.getByRole('button', { name: /Refresh Telemetry/i }));

    await waitFor(() => {
      expect(screen.getByText(/No pipeline runs reported yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub Commit Status Feed')).toBeInTheDocument();

    fireEvent.mouseDown(grafanaTab);
    fireEvent.click(grafanaTab);

    await waitFor(() => {
      expect(screen.getByText('Native Light-Mode Telemetry Active')).toBeInTheDocument();
    });
  });
});
