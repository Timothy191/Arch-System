import '@testing-library/jest-dom';
import { fetchClient } from '@repo/utils/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIMetricsDashboard from './AIMetricsDashboard';

jest.mock('@repo/utils/client', () => ({
  fetchClient: {
    get: jest.fn(),
  },
}));

const mockFetchGet = jest.mocked(fetchClient.get);

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const SAMPLE_RESPONSE = {
  success: true,
  metrics: {
    totalTokens: 2_450_000,
    totalPromptTokens: 1_800_000,
    totalCompletionTokens: 650_000,
    totalCachedTokens: 1_400_000,
    cacheHitRatio: 77.8,
    tokensSaved: 1_050_000,
    totalCostUSD: 14.25,
    totalCostZAR: 263.91,
    totalRequests: 128,
    avgLatency: 1120,
    byModel: [
      {
        name: 'claude-sonnet-4',
        tokens: 2_000_000,
        cost: 1200,
        requests: 100,
        cachedTokens: 1_200_000,
        percentage: 81.6,
      },
    ],
    recentUsage: [
      {
        id: 'u-1',
        timestamp: '2026-11-19T08:00:00Z',
        model: 'claude-sonnet-4',
        tokens: 4200,
        costCents: 18,
        latency: 950,
        status: 'success',
      },
    ],
    buildTelemetry: {
      systemHealth: {
        status: 'healthy',
        healthScore: 99.6,
        uptimePct: 99.98,
        subsystems: [
          {
            name: 'Redis L1/L2 Cache',
            status: 'healthy',
            detail: 'Connected at 127.0.0.1:6379',
            latencyMs: 1.2,
          },
          {
            name: 'Supabase Replica',
            status: 'degraded',
            detail: 'Elevated read latency',
            latencyMs: 95,
          },
        ],
      },
      exchangeRateZAR: 18.52,
      totalSessions: 42,
      totalTurns: 3600,
      totalTokens: 2_450_000,
      totalInputTokens: 1_800_000,
      totalOutputTokens: 650_000,
      cacheReadTokens: 1_400_000,
      uncachedInputTokens: 300_000,
      cacheWriteTokens: 100_000,
      claudeCodeRatesUSDPerMTok: {
        inputUncached: 3.0,
        cacheWrite: 3.75,
        cacheRead: 0.3,
        output: 15.0,
      },
      claudeCodeCost: {
        totalCostZAR: 263.91,
        totalCostUSD: 14.25,
        cacheSavingsZAR: 5008.73,
        costPerBugResolvedZAR: 94.46,
        costPerCommitZAR: 21.1,
        uncachedBaselineZAR: 1500.0,
        uncachedBaselineUSD: 80.99,
        breakdownZAR: {
          uncachedInputZAR: 80,
          cacheWriteZAR: 20,
          cacheReadZAR: 15,
          outputZAR: 148.91,
        },
      },
      avgUsage: {
        avgInputTokensPerTurn: 1250,
        avgOutputTokensPerTurn: 450,
        avgTotalTokensPerTurn: 1700,
        cacheHitRatePct: 77.8,
        cacheMissRatePct: 22.2,
        avgLatencyMs: 1120,
        p95LatencyMs: 2400,
        tokensPerSecond: 82.4,
      },
      redisCacheStats: {
        avgLatencyMs: 1.1,
        p95LatencyMs: 2.3,
      },
      engineeringVelocity: {
        bugsResolved: 92,
        totalCommits: 245,
        sqlMigrations: 174,
        linesInserted: 45210,
        retrospectivesCount: 18,
      },
      agentFleetBreakdown: [
        {
          agent: 'Claude Sonnet',
          role: 'Lead Engineer',
          costZAR: 200,
          sharePct: 75.8,
          bugsResolved: 60,
          tokens: 1_900_000,
          cachedTokens: 1_100_000,
          avgLatencyMs: 1100,
        },
      ],
      phaseBreakdown: [
        {
          phase: 'Phase 1: Core Infrastructure',
          costZAR: 120,
          tokens: 950_000,
          commits: 88,
          bugsResolved: 31,
        },
      ],
    },
  },
};

describe('AIMetricsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders executive build & runtime metrics with en-US formatted numbers and handles scope switching', async () => {
    mockFetchGet.mockResolvedValue(SAMPLE_RESPONSE);

    renderWithQueryClient(<AIMetricsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Executive AI Build & Runtime Intelligence')).toBeInTheDocument();
    });

    expect(screen.getByText(/42 sessions • 3,600 turns/i)).toBeInTheDocument();
    expect(screen.getByText('1,250 tok')).toBeInTheDocument();
    expect(screen.getByText('450 tok')).toBeInTheDocument();
    expect(screen.getByText('1,700 tok')).toBeInTheDocument();
    expect(screen.getByText('+45,210')).toBeInTheDocument();
    expect(screen.getAllByText('claude-sonnet-4').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '24H' }));
    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenCalledWith('/api/ai/metrics?scope=24h');
    });
  });

  it('renders empty model breakdown notice and error retry flow cleanly', async () => {
    mockFetchGet.mockRejectedValueOnce(new Error('Telemetry backend offline'));

    renderWithQueryClient(<AIMetricsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load AI metrics')).toBeInTheDocument();
    });
    expect(screen.getByText('Telemetry backend offline')).toBeInTheDocument();

    mockFetchGet.mockResolvedValueOnce({
      success: true,
      metrics: {
        ...SAMPLE_RESPONSE.metrics,
        byModel: [],
        recentUsage: [],
        buildTelemetry: undefined,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(
        screen.getByText(/No live portal user AI invocations in this window/i)
      ).toBeInTheDocument();
    });
  });
});
