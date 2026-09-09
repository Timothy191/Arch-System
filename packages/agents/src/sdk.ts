/**
 * @file sdk.ts
 * @description High-level Agent Quality SDK Framework for @repo/agents.
 * Provides unified entrypoints for pillar prompt assembly, output quality auditing, and reflection engine execution.
 */

import {
  SubagentCoordinator,
  type CoordinatorConfig,
  type Subtask,
  type TaskRunResult,
} from "./coordinator.js";
import { AgentPillarEnvelope, type AgentPillarConfig } from "./prompt-envelope.js";
import { QualityGate, type QualityAuditResult } from "./quality-gate.js";
import {
  ReflectionEngine,
  type VerifiedTaskResult,
  type ReflectionEngineOptions,
} from "./reflection-engine.js";

export { AgentPillarEnvelope, QualityGate, ReflectionEngine };
export type { AgentPillarConfig, QualityAuditResult, VerifiedTaskResult, ReflectionEngineOptions };

export interface AgentSDKOptions {
  coordinatorConfig?: CoordinatorConfig;
  defaultPillarConfig?: Partial<AgentPillarConfig>;
}

export class AgentQualitySDK {
  private coordinator: SubagentCoordinator;
  private reflectionEngine: ReflectionEngine;

  constructor(options: AgentSDKOptions = {}) {
    this.coordinator = new SubagentCoordinator(options.coordinatorConfig);
    this.reflectionEngine = new ReflectionEngine({
      coordinatorConfig: options.coordinatorConfig,
      pillarConfig: options.defaultPillarConfig,
    });
  }

  /**
   * One-line Quality Gate audit helper for code or diff text.
   */
  public audit(content: string, filePath?: string): QualityAuditResult {
    return QualityGate.auditContent(content, filePath);
  }

  /**
   * Formats Quality Gate audit results into Markdown feedback.
   */
  public formatFeedback(audit: QualityAuditResult): string {
    return QualityGate.formatDiagnosticFeedback(audit);
  }

  /**
   * Compiles system prompt adhering to the 9 Core Agent Setup Pillars.
   */
  public buildPillarPrompt(config: AgentPillarConfig, extraContext?: string): string {
    return AgentPillarEnvelope.compileSystemPrompt(config, extraContext);
  }

  /**
   * Executes subagent task with automated Quality Gate self-reflection loop.
   */
  public async runTask(
    task: Subtask,
    options: ReflectionEngineOptions = {},
  ): Promise<VerifiedTaskResult> {
    return this.reflectionEngine.executeTaskWithReflection(task, options);
  }

  /**
   * Runs multiple parallel subtasks cleanly with task decomposition.
   */
  public async runPlan(
    plan: Subtask[],
    options: ReflectionEngineOptions = {},
  ): Promise<VerifiedTaskResult[]> {
    const results: VerifiedTaskResult[] = [];
    for (const task of plan) {
      const res = await this.runTask(task, options);
      results.push(res);
    }
    return results;
  }
}

/**
  Factory helper to create an AgentQualitySDK instance.
 */
export function createAgentSDK(options: AgentSDKOptions = {}): AgentQualitySDK {
  return new AgentQualitySDK(options);
}
