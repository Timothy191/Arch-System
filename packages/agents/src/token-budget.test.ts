import {
  assessContextCompaction,
  estimateContentBlockTokens,
  estimateMessageTokens,
  FLAT_IMAGE_TOKEN_COST,
  TokenBudgetAgent,
} from './token-budget';

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

  describe('Multimodal Token Estimation & Context Compaction', () => {
    it('charges flat token cost for base64 image blocks instead of raw string bloat', () => {
      const largeBase64Payload = 'A'.repeat(400_000); // 400KB base64 string
      const imageBlock = {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/webp',
          payloadBase64: largeBase64Payload,
        },
      };

      const estimatedImageTokens = estimateContentBlockTokens(imageBlock);
      expect(estimatedImageTokens).toBe(FLAT_IMAGE_TOKEN_COST);
      // Raw string would have been 100,000 tokens (400,000 / 4)
      expect(estimatedImageTokens).toBeLessThan(100_000);
    });

    it('estimates text and tool results tokens proportionally', () => {
      const textBlock = {
        type: 'text' as const,
        text: '12345678', // 8 chars = 2 tokens
      };
      expect(estimateContentBlockTokens(textBlock)).toBe(2);

      const message = {
        role: 'user' as const,
        content: [
          textBlock,
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/png',
              payloadBase64: 'abc',
            },
          },
        ],
      };
      expect(estimateMessageTokens(message)).toBe(2 + FLAT_IMAGE_TOKEN_COST);
    });

    it('triggers soft compaction when usage exceeds 85% and critical hard drop at 95%', () => {
      const safeMessages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ];
      const safeAssessment = assessContextCompaction(safeMessages, 1000);
      expect(safeAssessment.shouldCompact).toBe(false);
      expect(safeAssessment.isCritical).toBe(false);
      expect(safeAssessment.action).toBe('none');

      // Create messages exceeding 850 tokens (85% of 1000 limit)
      const heavyMessages = Array.from({ length: 25 }, (_, idx) => ({
        role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'x'.repeat(160), // 40 tokens per turn * 25 = 1000 tokens
      }));

      const compactAssessment = assessContextCompaction(heavyMessages, 1000);
      expect(compactAssessment.shouldCompact).toBe(true);
      expect(compactAssessment.isCritical).toBe(true);
      expect(compactAssessment.action).toBe('critical_hard_drop');
      expect(compactAssessment.turnsToCompactCount).toBe(5); // 25 turns - 20 preserved
    });
  });
});
