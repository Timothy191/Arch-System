/**
 * Canonical telemetry summary type shared between `/api/ai/metrics` and `AIMetricsDashboard`.
 */
export interface BuildTelemetrySummary {
  lastUpdated: string;
  exchangeRateZAR: number;
  claudeCodeRatesUSDPerMTok: {
    inputUncached: number;
    cacheWrite: number;
    cacheRead: number;
    output: number;
  };
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  uncachedInputTokens: number;
  totalSessions: number;
  totalTurns: number;
  avgUsage: {
    avgInputTokensPerTurn: number;
    avgOutputTokensPerTurn: number;
    avgTotalTokensPerTurn: number;
    cacheHitRatePct: number;
    cacheMissRatePct: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    tokensPerSecond: number;
  };
  claudeCodeCost: {
    totalCostUSD: number;
    totalCostZAR: number;
    uncachedBaselineUSD: number;
    uncachedBaselineZAR: number;
    cacheSavingsUSD: number;
    cacheSavingsZAR: number;
    costPerBugResolvedZAR: number;
    costPerCommitZAR: number;
    breakdownZAR: {
      uncachedInputZAR: number;
      cacheWriteZAR: number;
      cacheReadZAR: number;
      outputZAR: number;
    };
  };
  engineeringVelocity: {
    totalCommits: number;
    fixCommits: number;
    featCommits: number;
    refactorCommits: number;
    filesTouched: number;
    linesInserted: number;
    linesDeleted: number;
    sqlMigrations: number;
    retrospectivesCount: number;
    tracerMilestones: number;
    bugsResolved: number;
    activeRulesTokens: number;
    activeSkillsTokens: number;
  };
  agentFleetBreakdown: Array<{
    agent: string;
    role: string;
    sharePct: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    avgLatencyMs: number;
    costZAR: number;
    bugsResolved: number;
  }>;
  phaseBreakdown: Array<{
    phase: string;
    tokens: number;
    costZAR: number;
    commits: number;
    bugsResolved: number;
  }>;
  redisCacheStats: {
    hits: number;
    misses: number;
    l1Hits: number;
    l2Hits: number;
    xFetchTriggers: number;
    redisErrors: number;
    hitRatePct: number;
    missRatePct: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthScore: number;
    uptimePct: number;
    subsystems: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      latencyMs: number;
      detail: string;
    }>;
  };
}
