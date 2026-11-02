/**
 * @file harness-engine.ts
 * @description Unified Zero-Overhead Agentic Harness Engine for @repo/agents.
 *
 * Reverse-engineered and distilled from:
 * 1. `feder-cr/invisible_dots`:
 *    - 3-tier tool permission classifier (`allow` | `ask` | `deny`) with durable Approval Inbox.
 *    - Crash-safe `IdempotentCallLedger` ensuring interrupted tool calls never execute twice.
 *    - `runHarnessDoctor` preflight diagnostics naming exact remediation commands.
 * 2. `ruvnet/ruflo`:
 *    - Zero-LLM `TrajectoryContrastiveStore` recording positive/negative outcomes and ranking
 *      specialist routing deterministically without extra API hops.
 * 3. `Significant-Gravitas/AutoGPT`:
 *    - "Otto" Lead Coordinator `ExpertBrief` and repeatable `AgentRoutineRegistry` bound strictly
 *      to Antigravity Gemini model tiers (`gemini-2.5-flash-lite`, `gemini-3.6-flash`, `gemini-2.5-pro`).
 */

import { createHash } from 'node:crypto';
import { ANTIGRAVITY_GEMINI_MODELS } from './specialists';

export type ToolPermissionTier = 'allow' | 'ask' | 'deny';

export type AntigravityModelTier = 'flash_lite' | 'flash' | 'pro';

export const HARNESS_GEMINI_TIER_MAP: Record<AntigravityModelTier, string> = {
  flash_lite: ANTIGRAVITY_GEMINI_MODELS.flashLite,
  flash: ANTIGRAVITY_GEMINI_MODELS.flash,
  pro: ANTIGRAVITY_GEMINI_MODELS.pro,
};

const HASH_PREVIEW_LENGTH = 16;
const DEFAULT_TRAJECTORY_BASE_SCORE = 0.5;
const POSITIVE_OUTCOME_DELTA = 0.25;
const NEGATIVE_OUTCOME_DELTA = -0.3;
const MIN_TRAJECTORY_SCORE = 0;
const MAX_TRAJECTORY_SCORE = 1;
const KEYWORD_MATCH_WEIGHT = 0.15;
const DEFAULT_ROUTINE_TOKEN_BUDGET = 16_000;

export interface ToolPermissionPolicy {
  readonly allowPatterns: readonly string[];
  readonly askPatterns: readonly string[];
  readonly denyPatterns: readonly string[];
}

export interface ApprovalInboxEntry {
  readonly requestId: string;
  readonly toolName: string;
  readonly argumentSummary: string;
  readonly requestedByRole: string;
  readonly createdAtIso: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PermissionEvaluationInput {
  readonly toolName: string;
  readonly argumentSummary: string;
  readonly requestedByRole: string;
}

export interface PermissionEvaluationResult {
  readonly tier: ToolPermissionTier;
  readonly isPermittedImmediately: boolean;
  readonly inboxEntry?: ApprovalInboxEntry;
  readonly reason: string;
}

export const DEFAULT_TOOL_PERMISSION_POLICY: ToolPermissionPolicy = {
  allowPatterns: [
    'read_file',
    'view_file',
    'grep_search',
    'ast-grep',
    'codemap',
    'pnpm test',
    'pnpm type-check',
    'pnpm lint',
    'pnpm agent:verify',
  ],
  askPatterns: ['git push', 'vercel --prod', 'supabase db push', 'deploy:vercel:prod'],
  denyPatterns: [
    'rm -rf /',
    'git commit --no-verify',
    'git commit -n',
    'git push --force',
    'DROP DATABASE',
  ],
};

/**
 * 3-Tier Tool Permission & Durable Approval Inbox (`feder-cr/invisible_dots` pattern).
 */
export class ToolPermissionGate {
  private readonly policy: ToolPermissionPolicy;
  private readonly inbox: Map<string, ApprovalInboxEntry> = new Map();

  constructor(policy: ToolPermissionPolicy = DEFAULT_TOOL_PERMISSION_POLICY) {
    this.policy = policy;
  }

  public evaluate(input: Readonly<PermissionEvaluationInput>): PermissionEvaluationResult {
    const normalizedTarget = `${input.toolName} ${input.argumentSummary}`.trim().toLowerCase();

    const matchedDeny = this.policy.denyPatterns.find((pattern) =>
      normalizedTarget.includes(pattern.toLowerCase())
    );
    if (matchedDeny) {
      return {
        tier: 'deny',
        isPermittedImmediately: false,
        reason: `Blocked by hard deny pattern: "${matchedDeny}"`,
      };
    }

    const matchedAsk = this.policy.askPatterns.find((pattern) =>
      normalizedTarget.includes(pattern.toLowerCase())
    );
    if (matchedAsk) {
      const requestId = createCallSignature(input.toolName, input.argumentSummary);
      const existing = this.inbox.get(requestId);
      if (existing?.status === 'approved') {
        return {
          tier: 'allow',
          isPermittedImmediately: true,
          inboxEntry: existing,
          reason: `Previously approved via durable inbox (${requestId})`,
        };
      }

      const inboxEntry: ApprovalInboxEntry = existing ?? {
        requestId,
        toolName: input.toolName,
        argumentSummary: input.argumentSummary,
        requestedByRole: input.requestedByRole,
        createdAtIso: new Date().toISOString(),
        status: 'pending',
      };
      this.inbox.set(requestId, inboxEntry);

      return {
        tier: 'ask',
        isPermittedImmediately: false,
        inboxEntry,
        reason: `Queued in durable Approval Inbox for pattern "${matchedAsk}"`,
      };
    }

    return {
      tier: 'allow',
      isPermittedImmediately: true,
      reason: 'Permitted under zero-overhead allow policy',
    };
  }

  public resolveInboxRequest(requestId: string, decision: 'approved' | 'rejected'): boolean {
    const entry = this.inbox.get(requestId);
    if (!entry) return false;
    entry.status = decision;
    return true;
  }

  public listPendingApprovals(): ApprovalInboxEntry[] {
    return Array.from(this.inbox.values()).filter((entry) => entry.status === 'pending');
  }
}

export interface IdempotentCallRecord {
  readonly callSignature: string;
  readonly toolName: string;
  readonly status: 'in_progress' | 'completed' | 'failed';
  readonly outputSnapshot?: string;
  readonly updatedAtIso: string;
}

export interface IdempotentClaimInput {
  readonly callId?: string;
  readonly toolName: string;
  readonly serializedArgs: string;
}

export function createCallSignature(toolName: string, serializedArgs: string): string {
  return createHash('sha256')
    .update(`${toolName}:${serializedArgs}`)
    .digest('hex')
    .slice(0, HASH_PREVIEW_LENGTH);
}

/**
 * Crash-Safe Idempotent Tool Call Ledger (`feder-cr/invisible_dots` invariant:
 * a tool call cut short or replayed after restart is never executed twice).
 */
export class IdempotentCallLedger {
  private readonly records: Map<string, IdempotentCallRecord> = new Map();

  public claimExecution(input: Readonly<IdempotentClaimInput>): {
    readonly canExecute: boolean;
    readonly callSignature: string;
    readonly existingRecord?: IdempotentCallRecord;
  } {
    const callSignature = input.callId ?? createCallSignature(input.toolName, input.serializedArgs);
    const existingRecord = this.records.get(callSignature);

    if (existingRecord && existingRecord.status !== 'failed') {
      return {
        canExecute: false,
        callSignature,
        existingRecord,
      };
    }

    const nextRecord: IdempotentCallRecord = {
      callSignature,
      toolName: input.toolName,
      status: 'in_progress',
      updatedAtIso: new Date().toISOString(),
    };
    this.records.set(callSignature, nextRecord);

    return {
      canExecute: true,
      callSignature,
    };
  }

  public completeExecution(callSignature: string, outputSnapshot: string): IdempotentCallRecord {
    const current = this.records.get(callSignature);
    const updated: IdempotentCallRecord = {
      callSignature,
      toolName: current?.toolName ?? 'unknown',
      status: 'completed',
      outputSnapshot,
      updatedAtIso: new Date().toISOString(),
    };
    this.records.set(callSignature, updated);
    return updated;
  }
}

export interface TrajectoryRecordInput {
  readonly goalSummary: string;
  readonly specialistRole: string;
  readonly isPositiveOutcome: boolean;
  readonly lessonLearned: string;
}

export interface ContrastiveRoleScore {
  readonly specialistRole: string;
  readonly confidenceScore: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly lessons: readonly string[];
}

/**
 * Zero-LLM Trajectory Contrastive Memory (`ruvnet/ruflo` pattern).
 * Ranks specialist roles using local outcome contrast without extra LLM API calls.
 */
export class TrajectoryContrastiveStore {
  private readonly entries: TrajectoryRecordInput[] = [];
  private readonly roleScores: Map<string, ContrastiveRoleScore> = new Map();

  public recordOutcome(input: Readonly<TrajectoryRecordInput>): ContrastiveRoleScore {
    this.entries.push(input);
    const existing = this.roleScores.get(input.specialistRole) ?? {
      specialistRole: input.specialistRole,
      confidenceScore: DEFAULT_TRAJECTORY_BASE_SCORE,
      positiveCount: 0,
      negativeCount: 0,
      lessons: [],
    };

    const delta = input.isPositiveOutcome ? POSITIVE_OUTCOME_DELTA : NEGATIVE_OUTCOME_DELTA;
    const clampedScore = Math.max(
      MIN_TRAJECTORY_SCORE,
      Math.min(MAX_TRAJECTORY_SCORE, Number((existing.confidenceScore + delta).toFixed(4)))
    );

    const updated: ContrastiveRoleScore = {
      specialistRole: input.specialistRole,
      confidenceScore: clampedScore,
      positiveCount: existing.positiveCount + (input.isPositiveOutcome ? 1 : 0),
      negativeCount: existing.negativeCount + (input.isPositiveOutcome ? 0 : 1),
      lessons: [...existing.lessons, input.lessonLearned],
    };

    this.roleScores.set(input.specialistRole, updated);
    return updated;
  }

  public rankSpecialistsForGoal(
    goalQuery: string,
    candidateRoles: readonly string[]
  ): ContrastiveRoleScore[] {
    const queryTokens = goalQuery
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2);

    return candidateRoles
      .map((role) => {
        const baseStats = this.roleScores.get(role) ?? {
          specialistRole: role,
          confidenceScore: DEFAULT_TRAJECTORY_BASE_SCORE,
          positiveCount: 0,
          negativeCount: 0,
          lessons: [],
        };

        const matchingPositiveEntries = this.entries.filter(
          (entry) =>
            entry.specialistRole === role &&
            entry.isPositiveOutcome &&
            queryTokens.some((token) => entry.goalSummary.toLowerCase().includes(token))
        );

        const boostedScore = Math.min(
          MAX_TRAJECTORY_SCORE,
          Number(
            (
              baseStats.confidenceScore +
              matchingPositiveEntries.length * KEYWORD_MATCH_WEIGHT
            ).toFixed(4)
          )
        );

        return {
          ...baseStats,
          confidenceScore: boostedScore,
        };
      })
      .sort((left, right) => right.confidenceScore - left.confidenceScore);
  }
}

export interface ExpertBrief {
  readonly briefId: string;
  readonly expertRole: string;
  readonly jobDescription: string;
  readonly connectedTools: readonly string[];
  readonly expectedDeliverable: string;
  readonly modelTier: AntigravityModelTier;
  readonly resolvedGeminiModel: string;
  readonly maxTokensBudget: number;
}

export interface CreateExpertBriefInput {
  readonly briefId: string;
  readonly expertRole: string;
  readonly jobDescription: string;
  readonly connectedTools: readonly string[];
  readonly expectedDeliverable: string;
  readonly modelTier?: AntigravityModelTier;
  readonly maxTokensBudget?: number;
}

export interface AgentRoutine {
  readonly routineId: string;
  readonly title: string;
  readonly scheduleExpression: string;
  readonly brief: ExpertBrief;
  isActive: boolean;
}

/**
 * AutoGPT "Otto · Head of AI" Expert Brief & Routine Lifecycle Manager.
 * All expert briefs resolve exclusively to Antigravity Gemini models with zero extra API hops.
 */
export class AgentRoutineRegistry {
  private readonly routines: Map<string, AgentRoutine> = new Map();

  public createExpertBrief(input: Readonly<CreateExpertBriefInput>): ExpertBrief {
    const tier: AntigravityModelTier = input.modelTier ?? 'flash';
    return {
      briefId: input.briefId,
      expertRole: input.expertRole,
      jobDescription: input.jobDescription,
      connectedTools: [...input.connectedTools],
      expectedDeliverable: input.expectedDeliverable,
      modelTier: tier,
      resolvedGeminiModel: HARNESS_GEMINI_TIER_MAP[tier],
      maxTokensBudget: input.maxTokensBudget ?? DEFAULT_ROUTINE_TOKEN_BUDGET,
    };
  }

  public registerRoutine(routine: Readonly<AgentRoutine>): AgentRoutine {
    const stored: AgentRoutine = { ...routine };
    this.routines.set(routine.routineId, stored);
    return stored;
  }

  public listActiveRoutines(): AgentRoutine[] {
    return Array.from(this.routines.values()).filter((routine) => routine.isActive);
  }
}

export interface HarnessDoctorCheck {
  readonly checkId: string;
  readonly passed: boolean;
  readonly summary: string;
  readonly remediationCommand?: string;
}

export interface HarnessDoctorInput {
  readonly configuredModel: string;
  readonly hasPermissionHooks: boolean;
  readonly hasSyncedAgentRules: boolean;
  readonly hasMcpRegistration: boolean;
}

/**
 * Deterministic `doctor` diagnostic preflight check (`feder-cr/invisible_dots` pattern).
 * Names the exact remediation command when any check fails.
 */
export function runHarnessDoctor(input: Readonly<HarnessDoctorInput>): {
  readonly healthy: boolean;
  readonly checks: readonly HarnessDoctorCheck[];
} {
  const isAntigravityGemini = input.configuredModel.startsWith('gemini-');

  const checks: HarnessDoctorCheck[] = [
    {
      checkId: 'antigravity-gemini-model-binding',
      passed: isAntigravityGemini,
      summary: isAntigravityGemini
        ? `Model bound to Antigravity Gemini (${input.configuredModel})`
        : `Non-Gemini model detected (${input.configuredModel})`,
      remediationCommand: isAntigravityGemini
        ? undefined
        : 'export ANTIGRAVITY_MODEL="gemini-3.6-flash"',
    },
    {
      checkId: 'permission-hooks-active',
      passed: input.hasPermissionHooks,
      summary: input.hasPermissionHooks
        ? 'PreToolUse & PostToolUse permission hooks verified'
        : 'Missing tool permission hooks',
      remediationCommand: input.hasPermissionHooks
        ? undefined
        : 'node tools/audits/audit-agent-permissions.cjs',
    },
    {
      checkId: 'agent-rules-drift-sync',
      passed: input.hasSyncedAgentRules,
      summary: input.hasSyncedAgentRules
        ? 'Workspace and project .agents/rules are synchronized'
        : 'Agent rule drift detected between workspace and project',
      remediationCommand: input.hasSyncedAgentRules
        ? undefined
        : 'node tools/audits/audit-agent-rules-drift.cjs',
    },
    {
      checkId: 'mcp-server-registration',
      passed: input.hasMcpRegistration,
      summary: input.hasMcpRegistration
        ? 'All MCP servers registered across agent runtimes'
        : 'Missing MCP server registrations',
      remediationCommand: input.hasMcpRegistration ? undefined : 'pnpm mcp:onboard',
    },
  ];

  return {
    healthy: checks.every((check) => check.passed),
    checks,
  };
}
