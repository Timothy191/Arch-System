import '@testing-library/jest-dom';
import type { CloudflareSummaryResponse } from '@repo/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CloudflareInfrastructureConsole } from './CloudflareInfrastructureConsole';

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

function buildLiveSummary(): CloudflareSummaryResponse {
  return {
    generatedAt: '2026-11-19T12:00:00.000Z',
    deploymentTarget: 'vercel',
    account: {
      id: 'cloudflare-account',
      label: 'Cloudflare Account',
      mode: 'live',
      endpointConfigured: true,
      latencyMs: 38,
      detail: 'Connected to Cloudflare edge account.',
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    zeroTrust: {
      mode: 'live',
      tokenConfigured: true,
      hasAccessReadScope: true,
      policies: [
        {
          id: 'pol-1',
          name: 'Mining Engineers SSO',
          applicationType: 'self_hosted',
          identityProviders: ['okta'],
          isActive: true,
          sessionDurationMinutes: 480,
          updatedAt: '2026-11-18T10:00:00.000Z',
        },
        {
          id: 'pol-2',
          name: 'Legacy Maintenance',
          applicationType: 'application',
          identityProviders: ['github'],
          isActive: false,
          sessionDurationMinutes: 60,
          updatedAt: null,
        },
      ],
      applications: [
        {
          id: 'app-1',
          name: 'Arch Portal',
          domain: 'portal.plantcor.example',
          type: 'self_hosted',
        },
      ],
      serviceTokens: [
        {
          id: 'st-1',
          name: 'CI Gate Token',
          clientIdPresent: true,
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      ],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    tunnel: {
      mode: 'live',
      tokenConfigured: true,
      tunnels: [
        {
          id: 'tun-1',
          name: 'brakfontein-edge-tunnel',
          status: 'active',
          routes: [{ hostname: 'scada.plantcor.example', service: 'http://localhost:1881' }],
          lastSeenAt: '2026-11-19T11:58:00.000Z',
          originHealthy: true,
        },
        {
          id: 'tun-2',
          name: 'standby-tunnel',
          status: 'pending',
          routes: [],
          lastSeenAt: null,
          originHealthy: null,
        },
      ],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    workers: {
      mode: 'live',
      tokenConfigured: true,
      workers: [
        {
          id: 'wrk-1',
          name: 'telemetry-ingress-worker',
          version: 'v1.4.0',
          hasDeployments: true,
          deploymentStatus: 'success',
          lastDeployedAt: '2026-11-19T09:00:00.000Z',
        },
        {
          id: 'wrk-2',
          name: 'draft-worker',
          version: null,
          hasDeployments: false,
          deploymentStatus: null,
          lastDeployedAt: null,
        },
      ],
      requestCount24h: 4500,
      errorRatePercent: 0.1,
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    queues: {
      mode: 'live',
      tokenConfigured: true,
      queues: [
        {
          id: 'q-1',
          name: 'telemetry-ingest-q',
          pendingMessages: 12,
          hasDlq: true,
          consumerHealthy: true,
          dlqDepth: 1,
        },
      ],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    turnstile: {
      mode: 'live',
      siteKeyConfigured: true,
      secretKeyConfigured: true,
      verificationHealthy: true,
      failureRatePercent: 0.02,
      protectedFlows: ['login'],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    aiGateway: {
      mode: 'live',
      tokenConfigured: true,
      featureEnabled: true,
      providers: ['anthropic'],
      requestCount24h: 810,
      avgLatencyMs: 215,
      errorRatePercent: 0,
      costReportingAvailable: true,
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    r2: {
      mode: 'live',
      tokenConfigured: true,
      buckets: [
        {
          id: 'r2-1',
          name: 'plantcor-shift-reports',
          isPublic: false,
          objectCount: 120,
          usageBytes: 1048576,
          hasLifecycleRules: true,
          versioningEnabled: true,
        },
        {
          id: 'r2-2',
          name: 'plantcor-public-check',
          isPublic: true,
          objectCount: 1,
          usageBytes: 2048,
          hasLifecycleRules: false,
          versioningEnabled: false,
        },
      ],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
    securityCentre: {
      mode: 'live',
      tokenConfigured: true,
      wafRules: 14,
      rateLimitRules: 5,
      accessPolicies: 2,
      warnings: ['Public bucket plantcor-public-check flagged for review.'],
      lastSyncedAt: '2026-11-19T11:59:00.000Z',
    },
  };
}

describe('CloudflareInfrastructureConsole', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders live Cloudflare sections, supports refresh, and handles empty/non-live modes', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(createJsonResponse(buildLiveSummary()))
      .mockResolvedValueOnce(
        createJsonResponse({
          generatedAt: '2026-11-19T12:05:00.000Z',
          deploymentTarget: 'local',
          account: {
            id: 'cloudflare-account',
            label: 'Cloudflare Account',
            mode: 'unconfigured',
            endpointConfigured: false,
            latencyMs: null,
            detail: 'Token missing.',
            lastSyncedAt: null,
          },
          zeroTrust: {
            mode: 'insufficient',
            tokenConfigured: true,
            hasAccessReadScope: false,
            policies: [],
            applications: [],
            serviceTokens: [],
            lastSyncedAt: null,
          },
          tunnel: {
            mode: 'live',
            tokenConfigured: true,
            tunnels: [],
            lastSyncedAt: null,
          },
          workers: {
            mode: 'unconfigured',
            tokenConfigured: false,
            workers: [],
            requestCount24h: null,
            errorRatePercent: null,
            lastSyncedAt: null,
          },
          queues: {
            mode: 'live',
            tokenConfigured: true,
            queues: [],
            lastSyncedAt: null,
          },
          turnstile: {
            mode: 'unconfigured',
            siteKeyConfigured: false,
            secretKeyConfigured: false,
            verificationHealthy: null,
            failureRatePercent: null,
            protectedFlows: [],
            lastSyncedAt: null,
          },
          aiGateway: {
            mode: 'unconfigured',
            tokenConfigured: false,
            featureEnabled: false,
            providers: [],
            requestCount24h: null,
            avgLatencyMs: null,
            errorRatePercent: null,
            costReportingAvailable: false,
            lastSyncedAt: null,
          },
          r2: {
            mode: 'live',
            tokenConfigured: true,
            buckets: [],
            lastSyncedAt: null,
          },
          securityCentre: {
            mode: 'fallback',
            tokenConfigured: true,
            wafRules: null,
            rateLimitRules: null,
            accessPolicies: null,
            warnings: [],
            lastSyncedAt: null,
          },
        } satisfies CloudflareSummaryResponse)
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ...buildLiveSummary(),
          workers: {
            mode: 'live',
            tokenConfigured: true,
            workers: [],
            requestCount24h: null,
            errorRatePercent: null,
            lastSyncedAt: null,
          },
        } satisfies CloudflareSummaryResponse)
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<CloudflareInfrastructureConsole />, { wrapper: createWrapper() });

    expect(screen.getByText(/Loading Cloudflare platform status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Mining Engineers SSO')).toBeInTheDocument();
    });

    expect(screen.getByText('38 ms')).toBeInTheDocument();
    expect(screen.getByText('brakfontein-edge-tunnel')).toBeInTheDocument();
    expect(screen.getByText('telemetry-ingress-worker')).toBeInTheDocument();
    expect(screen.getByText('telemetry-ingest-q')).toBeInTheDocument();
    expect(screen.getByText('12 pending · 1 DLQ')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('810')).toBeInTheDocument();
    expect(screen.getByText('plantcor-shift-reports')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(
      screen.getByText('Public bucket plantcor-public-check flagged for review.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/Refreshed /i)).toBeInTheDocument();
      expect(screen.getByText(/No tunnels found/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Not connected — set CLOUDFLARE_API_TOKEN to enable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Insufficient permissions — the API token lacks the required read scopes/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Metrics unavailable — Cloudflare API is unreachable/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/No Queues provisioned/i)).toBeInTheDocument();
    expect(screen.getByText(/No R2 buckets provisioned/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Gateway is opt-in/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/No Workers deployed/i)).toBeInTheDocument();
    });
  });

  it('renders an error alert card when /api/cloudflare/summary fails', async () => {
    globalThis.fetch = jest.fn(async () =>
      createJsonResponse({ error: 'Upstream timeout' }, false, 502)
    ) as unknown as typeof fetch;

    render(<CloudflareInfrastructureConsole />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Unable to load Cloudflare platform status/i)).toBeInTheDocument();
    });
  });
});
