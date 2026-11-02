import {
  AgentRoutineRegistry,
  HARNESS_GEMINI_TIER_MAP,
  IdempotentCallLedger,
  runHarnessDoctor,
  ToolPermissionGate,
  TrajectoryContrastiveStore,
} from './harness-engine';

describe('Unified Agentic Harness Engine (AutoGPT + RuFlo + invisible_dots)', () => {
  describe('Given ToolPermissionGate (invisible_dots 3-tier permission & inbox)', () => {
    it('When a tool matches allow, ask, or deny patterns, Then it routes deterministically and queues ask in durable inbox', () => {
      const gate = new ToolPermissionGate();

      const allowRes = gate.evaluate({
        toolName: 'pnpm test',
        argumentSummary: '--filter @repo/agents',
        requestedByRole: 'securityAndQualityGate',
      });
      expect(allowRes.tier).toBe('allow');
      expect(allowRes.isPermittedImmediately).toBe(true);

      const denyRes = gate.evaluate({
        toolName: 'bash',
        argumentSummary: 'git commit --no-verify -m "skip"',
        requestedByRole: 'uiEngineer',
      });
      expect(denyRes.tier).toBe('deny');
      expect(denyRes.isPermittedImmediately).toBe(false);

      const askRes = gate.evaluate({
        toolName: 'vercel --prod',
        argumentSummary: 'deploy portal',
        requestedByRole: 'deploymentSentinel',
      });
      expect(askRes.tier).toBe('ask');
      expect(askRes.isPermittedImmediately).toBe(false);
      expect(gate.listPendingApprovals()).toHaveLength(1);

      const requestId = askRes.inboxEntry?.requestId ?? '';
      expect(gate.resolveInboxRequest(requestId, 'approved')).toBe(true);

      const recheckRes = gate.evaluate({
        toolName: 'vercel --prod',
        argumentSummary: 'deploy portal',
        requestedByRole: 'deploymentSentinel',
      });
      expect(recheckRes.tier).toBe('allow');
      expect(recheckRes.isPermittedImmediately).toBe(true);
    });
  });

  describe('Given IdempotentCallLedger (invisible_dots crash-safe idempotency)', () => {
    it('When a tool call is claimed and completed, Then replay after restart never executes it twice', () => {
      const ledger = new IdempotentCallLedger();
      const firstClaim = ledger.claimExecution({
        toolName: 'write_file',
        serializedArgs: '{"path":"schema.sql"}',
      });

      expect(firstClaim.canExecute).toBe(true);
      ledger.completeExecution(firstClaim.callSignature, 'MIGRATION_APPLIED');

      const duplicateClaim = ledger.claimExecution({
        toolName: 'write_file',
        serializedArgs: '{"path":"schema.sql"}',
      });
      expect(duplicateClaim.canExecute).toBe(false);
      expect(duplicateClaim.existingRecord?.outputSnapshot).toBe('MIGRATION_APPLIED');
    });
  });

  describe('Given TrajectoryContrastiveStore (RuFlo zero-LLM contrastive learning)', () => {
    it('When positive and negative outcomes are recorded, Then specialists are ranked locally with zero LLM calls', () => {
      const store = new TrajectoryContrastiveStore();

      store.recordOutcome({
        goalSummary: 'Optimize PostgreSQL RLS initplan policy',
        specialistRole: 'databaseArchitect',
        isPositiveOutcome: true,
        lessonLearned: 'Wrap auth.uid() in scalar subquery for InitPlan caching',
      });

      store.recordOutcome({
        goalSummary: 'Optimize PostgreSQL RLS initplan policy',
        specialistRole: 'uiEngineer',
        isPositiveOutcome: false,
        lessonLearned: 'UI specialist cannot modify SQL migrations',
      });

      const ranked = store.rankSpecialistsForGoal('PostgreSQL RLS migration', [
        'uiEngineer',
        'databaseArchitect',
      ]);

      expect(ranked[0]?.specialistRole).toBe('databaseArchitect');
      expect(ranked[0]?.confidenceScore).toBeGreaterThan(ranked[1]?.confidenceScore ?? 0);
    });
  });

  describe('Given AgentRoutineRegistry (AutoGPT Otto Expert Briefs & Gemini model routing)', () => {
    it('When creating an expert brief and routine, Then all tiers resolve strictly to Antigravity Gemini models', () => {
      const registry = new AgentRoutineRegistry();
      const brief = registry.createExpertBrief({
        briefId: 'brief-shift-audit',
        expertRole: 'Database & Storage Architect',
        jobDescription: 'Verify shift closeout RPC and RLS InitPlan parity',
        connectedTools: ['read_file', 'pnpm audit:rls'],
        expectedDeliverable: 'Zero-drift RLS verification report',
        modelTier: 'pro',
      });

      expect(brief.resolvedGeminiModel).toBe(HARNESS_GEMINI_TIER_MAP.pro);

      registry.registerRoutine({
        routineId: 'routine-shift-audit',
        title: 'Shift Closeout RLS Routine',
        scheduleExpression: '0 */6 * * *',
        brief,
        isActive: true,
      });

      expect(registry.listActiveRoutines()).toHaveLength(1);
    });
  });

  describe('Given runHarnessDoctor (invisible_dots diagnostic preflight)', () => {
    it('When a check fails, Then it reports the exact remediation command', () => {
      const unhealthy = runHarnessDoctor({
        configuredModel: 'gpt-4o-mini',
        hasPermissionHooks: true,
        hasSyncedAgentRules: true,
        hasMcpRegistration: false,
      });

      expect(unhealthy.healthy).toBe(false);
      const modelCheck = unhealthy.checks.find(
        (check) => check.checkId === 'antigravity-gemini-model-binding'
      );
      expect(modelCheck?.passed).toBe(false);
      expect(modelCheck?.remediationCommand).toContain('ANTIGRAVITY_MODEL="gemini-3.6-flash"');
    });
  });
});
