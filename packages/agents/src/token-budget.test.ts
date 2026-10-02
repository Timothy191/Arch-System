import { TokenBudgetAgent } from './token-budget';

describe('TokenBudgetAgent System', () => {
  let agent: TokenBudgetAgent;

  beforeEach(() => {
    agent = new TokenBudgetAgent();
  });

  describe('Task Difficulty Assessment', () => {
    it('assesses a simple short prompt as trivial or low difficulty', () => {
      const assessment = agent.assessDifficulty({
        prompt: 'Check git status and report current branch.',
        stepsCount: 1,
        toolsRequiredCount: 1,
        filesTargetedCount: 1,
        domain: 'general',
      });

      expect(['trivial', 'low']).toContain(assessment.level);
      expect(assessment.score).toBeLessThanOrEqual(40);
      expect(assessment.factors.promptComplexity).toBeLessThanOrEqual(15);
    });

    it('assesses a multi-step component refactor as moderate difficulty', () => {
      const assessment = agent.assessDifficulty({
        prompt:
          'Refactor Button component to support secondary icon slot with Biome lint compliance.',
        stepsCount: 4,
        toolsRequiredCount: 2,
        filesTargetedCount: 3,
        domain: 'code',
      });

      expect(['low', 'moderate']).toContain(assessment.level);
      expect(assessment.score).toBeGreaterThan(20);
    });

    it('assesses a high-risk security audit or migration as high or extreme difficulty', () => {
      const assessment = agent.assessDifficulty({
        prompt:
          'Execute full architectural remediation and security audit across RBAC middleware, database migrations, and consensus swarm.',
        stepsCount: 8,
        toolsRequiredCount: 5,
        filesTargetedCount: 10,
        isMultiAgent: true,
        requiresReflection: true,
        domain: 'security',
      });

      expect(['high', 'extreme']).toContain(assessment.level);
      expect(assessment.score).toBeGreaterThanOrEqual(65);
    });
  });

  describe('Budget Plan Creation and Allocation', () => {
    it('creates a formal token allocation plan partitioned across participating roles', () => {
      const plan = agent.createBudgetPlan(
        {
          prompt: 'Execute forensic UI remediation for admin RBAC and department dashboards.',
          stepsCount: 5,
          domain: 'architecture',
        },
        ['coordinator', 'ui-engineer', 'security-auditor']
      );

      expect(plan.taskId).toBeDefined();
      expect(plan.totalBudget).toBeGreaterThan(0);
      expect(plan.remainingTokens).toEqual(plan.totalBudget);

      // Verify all participating roles have allocations
      expect(plan.roleAllocations.coordinator).toBeDefined();
      expect(plan.roleAllocations['ui-engineer']).toBeDefined();
      expect(plan.roleAllocations['security-auditor']).toBeDefined();

      const allocatedSum =
        (plan.roleAllocations.coordinator?.allocatedTokens ?? 0) +
        (plan.roleAllocations['ui-engineer']?.allocatedTokens ?? 0) +
        (plan.roleAllocations['security-auditor']?.allocatedTokens ?? 0);

      expect(allocatedSum + plan.reserveMargin + plan.toolCallBudget).toBeLessThanOrEqual(
        plan.totalBudget
      );
    });
  });

  describe('Usage Tracking, Warning Thresholds, and Circuit Breaking', () => {
    it('tracks token consumption and triggers warning when threshold reached', () => {
      const plan = agent.createBudgetPlan(
        {
          prompt: 'Trivial one-liner task',
          domain: 'general',
        },
        ['primary-agent']
      );

      const allocated = plan.roleAllocations['primary-agent']?.allocatedTokens ?? 1000;

      // Consume 85% of allocated tokens
      const result = agent.recordUsage(plan.taskId, 'primary-agent', {
        promptTokens: Math.floor(allocated * 0.5),
        completionTokens: Math.floor(allocated * 0.35),
      });

      expect(result.warningTriggered).toBe(true);
      expect(result.roleBudget.status).toBe('warning');
      expect(result.remainingTokens).toBeLessThan(plan.totalBudget);
    });

    it('enforces circuit-breaker or dips into reserve margin upon budget overrun', () => {
      const plan = agent.createBudgetPlan(
        {
          prompt: 'Trivial task',
          domain: 'general',
        },
        ['primary-agent']
      );

      const allocated = plan.roleAllocations['primary-agent']?.allocatedTokens ?? 1000;
      const initialReserve = plan.reserveMargin;

      // Overrun by 100 tokens
      const result = agent.recordUsage(plan.taskId, 'primary-agent', {
        promptTokens: allocated,
        completionTokens: 100,
      });

      if (initialReserve >= 100) {
        // Reserve buffer absorbed the overrun
        expect(result.roleBudget.status).toBe('warning');
        expect(plan.reserveMargin).toBe(initialReserve - 100);
      } else {
        expect(result.breached).toBe(true);
        expect(result.roleBudget.status).toBe('breached');
      }
    });

    it('supports dynamic token reallocation between roles', () => {
      const plan = agent.createBudgetPlan(
        {
          prompt: 'Collaborative task',
          domain: 'code',
        },
        ['coordinator', 'specialist']
      );

      const initialCoordinator = plan.roleAllocations.coordinator?.allocatedTokens ?? 0;
      const initialSpecialist = plan.roleAllocations.specialist?.allocatedTokens ?? 0;

      const success = agent.reallocateTokens(plan.taskId, 'coordinator', 'specialist', 500);

      expect(success).toBe(true);
      expect(plan.roleAllocations.coordinator?.allocatedTokens).toBe(initialCoordinator - 500);
      expect(plan.roleAllocations.specialist?.allocatedTokens).toBe(initialSpecialist + 500);
    });
  });
});
