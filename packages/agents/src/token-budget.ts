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

/**
 * Context compaction & multimodal constants inspired by alphacode_compaction_core.
 */
export const DEFAULT_CONTEXT_WINDOW_LIMIT = 200_000;
export const PROACTIVE_HANDOFF_THRESHOLD = 0.7;
export const COMPACTION_SOFT_THRESHOLD = 0.85;
export const COMPACTION_CRITICAL_THRESHOLD = 0.95;
export const COMPACTION_IDEMPOTENT_FLOOR = 0.25;
export const MIN_TURNS_BETWEEN_COMPACTIONS = 4;
export const MAX_COMPACTION_STATE_CHARS = 4000;
export const RARE_NEEDLE_MAX_DOCUMENT_FREQUENCY = 2;
export const RARE_NEEDLE_MIN_TOKEN_LENGTH = 6;
export const RECENT_TURNS_TO_PRESERVE = 20;
export const MINIMUM_TURNS_TO_PRESERVE = 2;
export const EMERGENCY_TOOL_RESULT_MAX_CHARS = 10_000;
export const EMERGENCY_IMAGE_MAX_CHARS = 1024;
export const FLAT_IMAGE_TOKEN_COST = 1200;
export const CHARS_PER_TEXT_TOKEN = 4;

export interface MultimodalContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    payloadBase64: string;
  };
  content?: string | MultimodalContentBlock[];
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContentBlock[];
}

export interface CompactionAssessment {
  estimatedTokens: number;
  maxContextTokens: number;
  usageRatio: number;
  shouldPrepareHandoff: boolean;
  shouldCompact: boolean;
  isCritical: boolean;
  turnsToCompactCount: number;
  action: 'none' | 'prepare_handoff' | 'soft_compaction' | 'critical_hard_drop';
}

export interface DoubleCompactionGuardInput {
  readonly currentTokens: number;
  readonly maxContextTokens?: number;
  readonly turnsSinceLastCompaction: number;
  readonly isDoubleSlashCommand?: boolean;
  readonly cachedPrefixTokens?: number;
}

export interface DoubleCompactionGuardVerdict {
  readonly decision: 'execute_full_compact' | 'consolidate_state_spine';
  readonly usageRatio: number;
  readonly avoidedCacheRebuildTokens: number;
  readonly shouldRunDeepMemorySweep: boolean;
  readonly reason: string;
}

export type CompactionStateValue =
  | string
  | number
  | boolean
  | readonly string[]
  | Record<string, string | number | boolean>;

export type CompactionStateSpine = Readonly<Record<string, CompactionStateValue>>;
export type CompactionStatePatch = Readonly<Record<string, CompactionStateValue | null>>;

export interface CompactionStatePatchResult {
  readonly applied: boolean;
  readonly nextState: CompactionStateSpine;
  readonly serializedChars: number;
  readonly maxAllowedChars: number;
  readonly rejectionReason?: string;
}

export interface RareNeedleExtractionOptions {
  readonly maxNeedles?: number;
  readonly maxDocumentFrequency?: number;
}

const DISTINCTIVE_IDENTIFIER_REGEX = /[A-Za-z0-9][A-Za-z0-9._:/@-]{5,}/g;
const BARE_NUMERIC_TIMESTAMP_REGEX = /^[0-9][0-9:.\-T/]*$/;
const ERROR_SIGNAL_REGEX = /\b(?:error|fatal|panic|failed|exception|traceback|violation)\b/i;

/**
 * Calculates estimated tokens for a single content block.
 * Uses flat token cost for images to prevent 50x bloat from base64 strings.
 */
export function estimateContentBlockTokens(block: MultimodalContentBlock): number {
  if (block.type === 'image') {
    return FLAT_IMAGE_TOKEN_COST;
  }

  if (block.type === 'text') {
    const textLength = block.text?.length ?? 0;
    return Math.max(1, Math.ceil(textLength / CHARS_PER_TEXT_TOKEN));
  }

  if (block.type === 'tool_result' || block.type === 'tool_use') {
    if (typeof block.content === 'string') {
      return Math.max(1, Math.ceil(block.content.length / CHARS_PER_TEXT_TOKEN));
    }
    if (Array.isArray(block.content)) {
      return block.content.reduce(
        (accum, childBlock) => accum + estimateContentBlockTokens(childBlock),
        0
      );
    }
    const textLength = block.text?.length ?? 0;
    return Math.max(1, Math.ceil(textLength / CHARS_PER_TEXT_TOKEN));
  }

  return 1;
}

/**
 * Calculates estimated tokens for an entire context message.
 */
export function estimateMessageTokens(message: ContextMessage): number {
  if (typeof message.content === 'string') {
    return Math.max(1, Math.ceil(message.content.length / CHARS_PER_TEXT_TOKEN));
  }

  if (Array.isArray(message.content)) {
    return message.content.reduce((accum, block) => accum + estimateContentBlockTokens(block), 0);
  }

  return 1;
}

/**
 * Assesses whether a conversation history requires proactive handoff or compaction
 * using multi-threshold gating (70% handoff, 85% soft compact, 95% critical drop).
 */
export function assessContextCompaction(
  messages: readonly ContextMessage[],
  maxContextTokens = DEFAULT_CONTEXT_WINDOW_LIMIT
): CompactionAssessment {
  const estimatedTokens = messages.reduce(
    (accum, message) => accum + estimateMessageTokens(message),
    0
  );
  const usageRatio = estimatedTokens / maxContextTokens;
  const isCritical = usageRatio >= COMPACTION_CRITICAL_THRESHOLD;
  const shouldCompact = usageRatio >= COMPACTION_SOFT_THRESHOLD;
  const shouldPrepareHandoff = usageRatio >= PROACTIVE_HANDOFF_THRESHOLD;

  let action: CompactionAssessment['action'] = 'none';
  if (isCritical) {
    action = 'critical_hard_drop';
  } else if (shouldCompact) {
    action = 'soft_compaction';
  } else if (shouldPrepareHandoff) {
    action = 'prepare_handoff';
  }

  const excessTurns = Math.max(0, messages.length - RECENT_TURNS_TO_PRESERVE);
  const turnsToCompactCount = shouldCompact ? excessTurns : 0;

  return {
    estimatedTokens,
    maxContextTokens,
    usageRatio,
    shouldPrepareHandoff,
    shouldCompact,
    isCritical,
    turnsToCompactCount,
    action,
  };
}

/**
 * Guards against redundant LLM prefix cache invalidation on `/compact/compact`
 * or back-to-back compactions when context fill is already below COMPACTION_IDEMPOTENT_FLOOR.
 */
export function evaluateDoubleCompactionGuard(
  input: DoubleCompactionGuardInput
): DoubleCompactionGuardVerdict {
  const maxContextTokens = input.maxContextTokens ?? DEFAULT_CONTEXT_WINDOW_LIMIT;
  const usageRatio = maxContextTokens > 0 ? input.currentTokens / maxContextTokens : 0;
  const cachedPrefixTokens = input.cachedPrefixTokens ?? input.currentTokens;
  const isBelowIdempotentFloor = usageRatio < COMPACTION_IDEMPOTENT_FLOOR;
  const isRecentCompaction = input.turnsSinceLastCompaction < MIN_TURNS_BETWEEN_COMPACTIONS;

  if (input.isDoubleSlashCommand || isBelowIdempotentFloor || isRecentCompaction) {
    return {
      decision: 'consolidate_state_spine',
      usageRatio,
      avoidedCacheRebuildTokens: cachedPrefixTokens,
      shouldRunDeepMemorySweep: Boolean(input.isDoubleSlashCommand || isBelowIdempotentFloor),
      reason:
        'Context is recently compacted or invoked via /compact/compact; consolidating on-disk state spine and retrospectives without invalidating warm LLM prefix cache.',
    };
  }

  return {
    decision: 'execute_full_compact',
    usageRatio,
    avoidedCacheRebuildTokens: 0,
    shouldRunDeepMemorySweep: usageRatio >= PROACTIVE_HANDOFF_THRESHOLD,
    reason: 'Context fill exceeds idempotent floor and turn interval; full compaction permitted.',
  };
}

/**
 * Applies a Google/Purdue `SKILL.state` bounded O(1) patch to the compaction state spine.
 * Setting a patch key to `null` deletes the key; total serialized length is capped at 4,000 chars.
 */
export function applyCompactionStatePatch(
  currentState: CompactionStateSpine,
  patch: CompactionStatePatch
): CompactionStatePatchResult {
  const mutableNext: Record<string, CompactionStateValue> = { ...currentState };

  for (const [key, patchEntry] of Object.entries(patch)) {
    if (patchEntry === null) {
      delete mutableNext[key];
    } else {
      mutableNext[key] = patchEntry;
    }
  }

  const serialized = JSON.stringify(mutableNext);
  if (serialized.length > MAX_COMPACTION_STATE_CHARS) {
    return {
      applied: false,
      nextState: currentState,
      serializedChars: serialized.length,
      maxAllowedChars: MAX_COMPACTION_STATE_CHARS,
      rejectionReason: `Compaction state spine (${serialized.length} chars) exceeds O(1) cap of ${MAX_COMPACTION_STATE_CHARS} chars; prune completed keys with null first.`,
    };
  }

  return {
    applied: true,
    nextState: mutableNext,
    serializedChars: serialized.length,
    maxAllowedChars: MAX_COMPACTION_STATE_CHARS,
  };
}

/**
 * Extracts error lines and rare identifier lines (IDF needle preservation) from verbose log text
 * so middle-window truncation never drops unique UUIDs, file paths, or error traces.
 */
export function extractRareNeedlesFromLog(
  rawLogText: string,
  options: RareNeedleExtractionOptions = {}
): readonly string[] {
  const maxNeedles = options.maxNeedles ?? 12;
  const maxDocFreq = options.maxDocumentFrequency ?? RARE_NEEDLE_MAX_DOCUMENT_FREQUENCY;
  const lines = rawLogText.split('\n');
  if (lines.length === 0) {
    return [];
  }

  const tokenDocFrequency = new Map<string, number>();
  const perLineTokens: Array<readonly string[]> = [];

  for (const line of lines) {
    const uniqueTokensInLine = new Set<string>();
    for (const match of line.matchAll(DISTINCTIVE_IDENTIFIER_REGEX)) {
      const candidate = match[0];
      if (!candidate || candidate.length < RARE_NEEDLE_MIN_TOKEN_LENGTH) continue;
      if (BARE_NUMERIC_TIMESTAMP_REGEX.test(candidate)) continue;
      if (!/[A-Za-z]/.test(candidate)) continue;
      uniqueTokensInLine.add(candidate);
    }
    const tokenList = Array.from(uniqueTokensInLine);
    perLineTokens.push(tokenList);
    for (const token of tokenList) {
      tokenDocFrequency.set(token, (tokenDocFrequency.get(token) ?? 0) + 1);
    }
  }

  const preservedLines: string[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx] ?? '';
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isErrorLine = ERROR_SIGNAL_REGEX.test(trimmed);
    const lineTokens = perLineTokens[lineIdx] ?? [];
    const hasRareIdentifier = lineTokens.some(
      (token) => (tokenDocFrequency.get(token) ?? 0) <= maxDocFreq
    );

    if (isErrorLine || hasRareIdentifier) {
      preservedLines.push(trimmed);
      if (preservedLines.length >= maxNeedles) {
        break;
      }
    }
  }

  return preservedLines;
}
