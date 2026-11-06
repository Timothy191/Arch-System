jest.mock('@babel/core', () => ({ parseSync: () => null, traverse: () => undefined }), {
  virtual: true,
});

import {
  AgentRoutineRegistry,
  evaluateAtomicFeatureCapability,
  HARNESS_GEMINI_TIER_MAP,
  IdempotentCallLedger,
  runHarnessDoctor,
  ToolPermissionGate,
  TrajectoryContrastiveStore,
  validateArchitecturePosture,
} from './harness-engine';
import { AgentPillarEnvelope } from './prompt-envelope';
import { QualityGate } from './quality-gate';

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
        hasStructuredThinkingMandate: false,
      });

      expect(unhealthy.healthy).toBe(false);
      const modelCheck = unhealthy.checks.find(
        (check) => check.checkId === 'antigravity-gemini-model-binding'
      );
      expect(modelCheck?.passed).toBe(false);
      expect(modelCheck?.remediationCommand).toContain('ANTIGRAVITY_MODEL="gemini-3.6-flash"');

      const stmCheck = unhealthy.checks.find(
        (check) => check.checkId === 'stm-0-structured-thinking-mandate'
      );
      expect(stmCheck?.passed).toBe(false);
      expect(stmCheck?.remediationCommand).toContain('audit-agentic-content.cjs --check');
    });
  });

  describe('Given STM-0 Structured Thinking Mandate (QualityGate & AgentPillarEnvelope)', () => {
    it('When validating agent output, Then Format A (<structured-thinking>) and Format C (AGENT_TRACER Phase 1..5) pass while unreasoned outputs fail with THINKING_MISSING', () => {
      const formatA = `
<structured-thinking>
## Phase 1: Situational Comprehension
Understand Control Room SCADA telemetry flow.
## Phase 2: Evidence Gathering
Inspected AlertPanel.tsx and ControlRoomSummaryGridClient.tsx.
## Phase 3: Solution Design
Compared inline separator vs component wrapper.
## Phase 4: Pre-Commit Criticism
Checked Tailwind 20-class limit and light-mode tokens.
## Phase 5: Execution Contract
Verify with pnpm test and pnpm agent:verify.
</structured-thinking>
`;
      const validA = QualityGate.validateStructuredThinking(formatA);
      expect(validA.compliant).toBe(true);
      expect(validA.detectedFormat).toBe('format-a-inline');
      expect(validA.completedPhases).toHaveLength(5);

      const formatC = `
- **Phase 1 (Comprehension)**: Update Control Room KPI cards.
- **Phase 2 (Evidence)**: Inspected ControlRoomSummaryGridClient.tsx.
- **Phase 3 (Design)**: Added gradient separator underneath metric values.
- **Phase 4 (Criticism)**: Verified zero regressions in ControlRoomPanels.test.tsx.
- **Phase 5 (Contract)**: Modified ControlRoomSummaryGridClient.tsx.
`;
      const validC = QualityGate.validateStructuredThinking(formatC);
      expect(validC.compliant).toBe(true);
      expect(validC.detectedFormat).toBe('format-c-tracer');

      const missingThinking = QualityGate.validateStructuredThinking('const x = 1;');
      expect(missingThinking.compliant).toBe(false);
      expect(missingThinking.violationCode).toBe('THINKING_MISSING');

      const incompletePhases = QualityGate.validateStructuredThinking(
        '<structured-thinking>Phase 1: Comprehension only</structured-thinking>'
      );
      expect(incompletePhases.compliant).toBe(false);
      expect(incompletePhases.violationCode).toBe('INCOMPLETE_STM_PHASES');
      expect(incompletePhases.missingPhases.length).toBeGreaterThan(0);
    });

    it('When compiling AgentPillarEnvelope system prompt, Then Section 5B STM-0 protocol is embedded', () => {
      const prompt = AgentPillarEnvelope.compileSystemPrompt({
        identity: {
          name: 'test-specialist',
          mode: 'subagent',
          routingDescription: 'Test STM-0 prompt compilation',
        },
        runtime: {},
        permissions: {
          allowedTools: ['read_file'],
          filesystemAccess: 'read_only',
          bashAllowed: false,
        },
        scope: {
          includePaths: ['packages/agents/**'],
        },
      });

      expect(prompt).toContain('### 5B. STRUCTURED THINKING MANDATE (STM-0 PROTOCOL)');
      expect(prompt).toContain('MTP-1: PHASE 1 (COMPREHENSION)');
      expect(prompt).toContain('MTP-5: PHASE 5 (EXECUTION CONTRACT)');
    });
  });

  describe('Given Golden-Fixture Routine Certification (war851/AI-Governance-Architecture pattern)', () => {
    it('When a routine passes all golden fixtures, Then isRoutineCertified returns true', () => {
      const registry = new AgentRoutineRegistry();
      const report = registry.certifyRoutine({
        routineId: 'routine-shift-audit',
        goldenFixtures: [
          {
            fixtureId: 'rls-initplan-check',
            sampleInput: 'CREATE POLICY shift_select ON shifts USING (user_id = auth.uid());',
            expectedTokensInOutput: ['scalar subquery', '(select auth.uid())'],
          },
        ],
        evaluator: () => 'Wrap auth.uid() in a scalar subquery: (select auth.uid())',
      });

      expect(report.certified).toBe(true);
      expect(report.passRate).toBe(1);
      expect(registry.isRoutineCertified('routine-shift-audit')).toBe(true);
    });
  });

  describe('Given AtomicFeatureContract (AdrianBesleaga/AIFA pattern)', () => {
    it('When an invocation requests undeclared capabilities or lacks cache tags on db:write, Then it rejects with explicit violations', () => {
      const shiftCloseoutContract = {
        featureId: 'control-room.shift-closeout',
        departmentScope: 'control-room',
        allowedRoles: ['supervisor', 'admin'],
        declaredCapabilities: ['db:read', 'db:write', 'redis:cache'] as const,
        cacheTagsToInvalidate: ['dept:control-room:shift_closeout'],
        mcpExposed: false,
      };

      const validVerdict = evaluateAtomicFeatureCapability(shiftCloseoutContract, {
        actorRole: 'supervisor',
        requestedCapabilities: ['db:write'],
      });
      expect(validVerdict.permitted).toBe(true);

      const unauthorizedVerdict = evaluateAtomicFeatureCapability(shiftCloseoutContract, {
        actorRole: 'viewer',
        requestedCapabilities: ['scada:telemetry'],
        isMcpTransport: true,
      });
      expect(unauthorizedVerdict.permitted).toBe(false);
      expect(unauthorizedVerdict.violations).toHaveLength(3);
    });
  });

  describe('Given validateArchitecturePosture (Balchandar/Architect-Studio-X pattern)', () => {
    it('When a proposal violates workspace boundaries or lacks Zod/RLS parity on migrations, Then it blocks execution deterministically', () => {
      const invalidProposal = validateArchitecturePosture({
        proposalId: 'prop-invalid-layer',
        sourceWorkspace: 'packages/ui',
        targetWorkspaces: ['packages/database', 'packages/theme'],
        touchesDatabaseMigration: true,
        hasContractZodSchemaUpdate: false,
        hasRlsInitPlanPolicy: false,
      });

      expect(invalidProposal.approvedForExecution).toBe(false);
      expect(invalidProposal.violations).toHaveLength(3);

      const validProposal = validateArchitecturePosture({
        proposalId: 'prop-valid-feature',
        sourceWorkspace: 'apps/portal',
        targetWorkspaces: ['packages/supabase', 'packages/ui'],
        touchesDatabaseMigration: true,
        hasContractZodSchemaUpdate: true,
        hasRlsInitPlanPolicy: true,
      });

      expect(validProposal.approvedForExecution).toBe(true);
      expect(validProposal.violations).toHaveLength(0);
    });
  });
});
