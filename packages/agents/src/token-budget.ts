/**
 * @file token-budget.ts
 * @description Token Budget Agent and Allocation System.
 * Controls the distribution and allocation of LLM context and generation tokens
 * dynamically based on empirical task difficulty, reasoning depth, and agent topology.
 */

export type TaskDifficulty = 'trivial' | 'low' | 'moderate' | 'high' | 'extreme';

export interface TaskEvaluationContext {
  id?: string;
  prompt: string;
  stepsCount?: number;
  toolsRequiredCount?: number;
  filesTargetedCount?: number;
  isMultiAgent?: boolean;
  requiresReflection?: boolean;
  domain?: 'code' | 'architecture' | 'security' | 'migration' | 'general' | 'audit';
}

export interface DifficultyAssessment {
  score: number; // 1 to 100
  level: TaskDifficulty;
  factors: {
    promptComplexity: number;
    scopeScale: number;
    reasoningDepth: number;
    agentTopology: number;
  };
  rationale: string;
}

export interface RoleBudget {
  role: string;
  allocatedTokens: number;
  maxOutputTokens: number;
  consumed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  status: 'within_budget' | 'warning' | 'breached';
}

export interface TokenBudgetConfig {
  warningThresholdPercent?: number; // default: 80%
  enforceHardCap?: boolean; // default: true
  customTiers?: Partial<
    Record<
      TaskDifficulty,
      {
        totalTokens: number;
        contextWindowLimit: number;
        maxOutputTokens: number;
        toolCallBudget: number;
        reserveMargin: number;
      }
    >
  >;
}

export interface TokenBudgetPlan {
  taskId: string;
  difficulty: DifficultyAssessment;
  totalBudget: number;
  contextWindowLimit: number;
  maxOutputTokens: number;
  toolCallBudget: number;
  reserveMargin: number;
  remainingTokens: number;
  roleAllocations: Record<string, RoleBudget>;
}

export const DEFAULT_BUDGET_TIERS: Record<
  TaskDifficulty,
  {
    totalTokens: number;
    contextWindowLimit: number;
    maxOutputTokens: number;
    toolCallBudget: number;
    reserveMargin: number;
  }
> = {
  trivial: {
    totalTokens: 3500,
    contextWindowLimit: 2000,
    maxOutputTokens: 800,
    toolCallBudget: 500,
    reserveMargin: 200,
  },
  low: {
    totalTokens: 8000,
    contextWindowLimit: 4000,
    maxOutputTokens: 1500,
    toolCallBudget: 1500,
    reserveMargin: 1000,
  },
  moderate: {
    totalTokens: 22000,
    contextWindowLimit: 12000,
    maxOutputTokens: 4000,
    toolCallBudget: 4000,
    reserveMargin: 2000,
  },
  high: {
    totalTokens: 52000,
    contextWindowLimit: 32000,
    maxOutputTokens: 8000,
    toolCallBudget: 8000,
    reserveMargin: 4000,
  },
  extreme: {
    totalTokens: 104000,
    contextWindowLimit: 64000,
    maxOutputTokens: 16000,
    toolCallBudget: 16000,
    reserveMargin: 8000,
  },
};

/**
 * Token Budget Agent
 * Evaluates task difficulty and governs the distribution, consumption,
 * and circuit-breaking of LLM tokens across single-agent and multi-agent swarms.
 */
export class TokenBudgetAgent {
  private config: Required<TokenBudgetConfig>;
  private tiers: typeof DEFAULT_BUDGET_TIERS;
  private activePlans: Map<string, TokenBudgetPlan> = new Map();

  constructor(config: TokenBudgetConfig = {}) {
    this.config = {
      warningThresholdPercent: config.warningThresholdPercent ?? 80,
      enforceHardCap: config.enforceHardCap ?? true,
      customTiers: config.customTiers || {},
    };

    this.tiers = {
      ...DEFAULT_BUDGET_TIERS,
      ...this.config.customTiers,
    };
  }

  /**
   * Assesses the empirical difficulty of a task based on prompt dynamics,
   * step count, tooling, targeted files, and domain risk.
   */
  public assessDifficulty(context: TaskEvaluationContext): DifficultyAssessment {
    // 1. Prompt Complexity (Length and Keyword heuristic)
    const promptLen = context.prompt.trim().length;
    let promptComplexity = Math.min(30, Math.floor(promptLen / 150));

    // Weight heavily for critical or deep-reasoning intent
    const highComplexityKeywords = [
      'remediate',
      'forensic',
      'architecture',
      'refactor',
      'security',
      'audit',
      'migration',
      'consensus',
      'adversarial',
      'swarm',
      'rbacc',
      'rbac',
    ];
    const promptLower = context.prompt.toLowerCase();
    let keywordHits = 0;
    for (const kw of highComplexityKeywords) {
      if (promptLower.includes(kw)) keywordHits++;
    }
    promptComplexity = Math.min(30, promptComplexity + keywordHits * 3);

    // 2. Scope Scale (Files targeted, steps, tools)
    const steps = context.stepsCount ?? 1;
    const tools = context.toolsRequiredCount ?? 1;
    const files = context.filesTargetedCount ?? 1;
    const scopeScale = Math.min(30, steps * 3 + tools * 2 + files * 4);

    // 3. Reasoning Depth & Domain
    let reasoningDepth = 10;
    if (context.requiresReflection) reasoningDepth += 10;
    if (context.domain === 'security' || context.domain === 'migration') reasoningDepth += 10;
    else if (context.domain === 'architecture' || context.domain === 'audit') reasoningDepth += 8;
    else if (context.domain === 'code') reasoningDepth += 5;
    reasoningDepth = Math.min(25, reasoningDepth);

    // 4. Agent Topology
    const agentTopology = context.isMultiAgent ? 15 : 5;

    // Total Score calculation (1 to 100)
    const totalScore = Math.max(
      1,
      Math.min(100, promptComplexity + scopeScale + reasoningDepth + agentTopology)
    );

    let level: TaskDifficulty;
    let rationale: string;

    if (totalScore <= 20) {
      level = 'trivial';
      rationale = 'Low prompt volume, minimal file touched, straightforward single-step execution.';
    } else if (totalScore <= 40) {
      level = 'low';
      rationale = 'Standard single-agent scope, bounded step count, isolated component/file.';
    } else if (totalScore <= 65) {
      level = 'moderate';
      rationale =
        'Multi-step execution, multiple files or tools involved, moderate reasoning requirements.';
    } else if (totalScore <= 85) {
      level = 'high';
      rationale =
        'Cross-boundary system changes, security or architecture impact, multi-agent or reflection required.';
    } else {
      level = 'extreme';
      rationale =
        'Full-system forensic pass, multi-agent swarm orchestration, high blast radius and high critical reasoning.';
    }

    return {
      score: totalScore,
      level,
      factors: {
        promptComplexity,
        scopeScale,
        reasoningDepth,
        agentTopology,
      },
      rationale,
    };
  }

  /**
   * Creates a formal token allocation plan for a task or swarm.
   */
  public createBudgetPlan(
    context: TaskEvaluationContext,
    participatingRoles: string[] = ['primary-agent']
  ): TokenBudgetPlan {
    const taskId = context.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const difficulty = this.assessDifficulty(context);
    const tier = this.tiers[difficulty.level];

    // Allocate distribution across participating roles
    const roleAllocations: Record<string, RoleBudget> = {};
    const effectiveRoles = participatingRoles.length > 0 ? participatingRoles : ['primary-agent'];

    // Subdivide generation budget among roles based on role weighting
    const roleWeights: Record<string, number> = {};
    let totalWeight = 0;

    for (const role of effectiveRoles) {
      const lower = role.toLowerCase();
      let weight = 1;
      if (lower.includes('coordinator') || lower.includes('orchestrator')) weight = 1.5;
      else if (
        lower.includes('specialist') ||
        lower.includes('engineer') ||
        lower.includes('generator')
      )
        weight = 2.0;
      else if (
        lower.includes('reviewer') ||
        lower.includes('critic') ||
        lower.includes('reflection')
      )
        weight = 1.2;
      else if (lower.includes('watchdog') || lower.includes('auditor')) weight = 1.0;

      roleWeights[role] = weight;
      totalWeight += weight;
    }

    const availableRoleTokens = tier.totalTokens - tier.reserveMargin - tier.toolCallBudget;

    for (const role of effectiveRoles) {
      const weight = roleWeights[role] ?? 1;
      const ratio = weight / totalWeight;
      const allocated = Math.floor(availableRoleTokens * ratio);
      const roleMaxOutput = Math.min(tier.maxOutputTokens, Math.floor(allocated * 0.4));

      roleAllocations[role] = {
        role,
        allocatedTokens: allocated,
        maxOutputTokens: roleMaxOutput,
        consumed: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        status: 'within_budget',
      };
    }

    const plan: TokenBudgetPlan = {
      taskId,
      difficulty,
      totalBudget: tier.totalTokens,
      contextWindowLimit: tier.contextWindowLimit,
      maxOutputTokens: tier.maxOutputTokens,
      toolCallBudget: tier.toolCallBudget,
      reserveMargin: tier.reserveMargin,
      remainingTokens: tier.totalTokens,
      roleAllocations,
    };

    this.activePlans.set(taskId, plan);
    return plan;
  }

  /**
   * Retrieves an active budget plan by task ID.
   */
  public getBudgetPlan(taskId: string): TokenBudgetPlan | undefined {
    return this.activePlans.get(taskId);
  }

  /**
   * Records token usage for a specific role or subtask under an active plan.
   * Enforces warning thresholds and hard-cap circuit breakers.
   */
  public recordUsage(
    taskId: string,
    role: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ): {
    plan: TokenBudgetPlan;
    roleBudget: RoleBudget;
    warningTriggered: boolean;
    breached: boolean;
    remainingTokens: number;
  } {
    const plan = this.activePlans.get(taskId);
    if (!plan) {
      throw new Error(`TokenBudgetAgent: No active budget plan found for task ID "${taskId}"`);
    }

    let roleBudget = plan.roleAllocations[role];
    if (!roleBudget) {
      // Auto-register ad-hoc role from reserve margin
      const adHocBudget = Math.min(plan.reserveMargin, 1000);
      roleBudget = {
        role,
        allocatedTokens: adHocBudget,
        maxOutputTokens: Math.floor(adHocBudget * 0.4),
        consumed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        status: 'within_budget',
      };
      plan.roleAllocations[role] = roleBudget;
      plan.reserveMargin -= adHocBudget;
    }

    const promptTokens = usage.promptTokens ?? 0;
    const completionTokens = usage.completionTokens ?? 0;
    const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;

    roleBudget.consumed.promptTokens += promptTokens;
    roleBudget.consumed.completionTokens += completionTokens;
    roleBudget.consumed.totalTokens += totalTokens;

    plan.remainingTokens = Math.max(0, plan.remainingTokens - totalTokens);

    // Evaluate role status against warning threshold and cap
    const roleUsagePercent = (roleBudget.consumed.totalTokens / roleBudget.allocatedTokens) * 100;
    let warningTriggered = false;
    let breached = false;

    if (roleBudget.consumed.totalTokens > roleBudget.allocatedTokens) {
      roleBudget.status = 'breached';
      breached = true;
      if (this.config.enforceHardCap) {
        // Can dip into reserve margin if available
        const overrun = roleBudget.consumed.totalTokens - roleBudget.allocatedTokens;
        if (plan.reserveMargin >= overrun) {
          plan.reserveMargin -= overrun;
          roleBudget.allocatedTokens += overrun;
          roleBudget.status = 'warning';
          breached = false;
          warningTriggered = true;
        }
      }
    } else if (roleUsagePercent >= this.config.warningThresholdPercent) {
      roleBudget.status = 'warning';
      warningTriggered = true;
    } else {
      roleBudget.status = 'within_budget';
    }

    return {
      plan,
      roleBudget,
      warningTriggered,
      breached,
      remainingTokens: plan.remainingTokens,
    };
  }

  /**
   * Reallocates unused token budget from one role to another.
   */
  public reallocateTokens(
    taskId: string,
    fromRole: string,
    toRole: string,
    amount: number
  ): boolean {
    const plan = this.activePlans.get(taskId);
    if (!plan) return false;

    const source = plan.roleAllocations[fromRole];
    const target = plan.roleAllocations[toRole];
    if (!source || !target) return false;

    const availableToTransfer = source.allocatedTokens - source.consumed.totalTokens;
    const transferAmount = Math.min(amount, Math.max(0, availableToTransfer));

    if (transferAmount <= 0) return false;

    source.allocatedTokens -= transferAmount;
    target.allocatedTokens += transferAmount;
    return true;
  }
}
