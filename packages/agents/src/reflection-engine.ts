/**
 * @file reflection-engine.ts
 * @description Autonomous Agent Execution Engine with Iterative Self-Reflection & Auto-Remediation.
 * Wraps specialist subagents in a QualityGate verification loop to guarantee high quality output.
 */

import { SubagentCoordinator, type CoordinatorConfig, type Subtask } from "./coordinator.js";
import { AgentPillarEnvelope, type AgentPillarConfig } from "./prompt-envelope.js";
import { QualityGate, type QualityAuditResult } from "./quality-gate.js";

export interface VerifiedTaskResult {
  subtaskId: string;
  success: boolean;
  output: string;
  iterations: number;
  qualityAudit: QualityAuditResult;
  auditTrail: Array<{
    iteration: number;
    auditPassed: boolean;
    feedback: string;
  }>;
}

export interface ReflectionEngineOptions {
  coordinatorConfig?: CoordinatorConfig;
  pillarConfig?: Partial<AgentPillarConfig>;
  maxReflectionIterations?: number;
  targetFilePath?: string;
}

export class ReflectionEngine {
  private coordinator: SubagentCoordinator;
  private maxIterations: number;

  constructor(options: ReflectionEngineOptions = {}) {
    this.coordinator = new SubagentCoordinator(options.coordinatorConfig);
    this.maxIterations = options.maxReflectionIterations ?? 3;
  }

  /**
   * Runs a specialist task through an iterative generate -> audit -> reflect -> auto-correct loop.
   */
  public async executeTaskWithReflection(
    task: Subtask,
    options: ReflectionEngineOptions = {},
  ): Promise<VerifiedTaskResult> {
    const maxRetries = options.maxReflectionIterations ?? this.maxIterations;
    const filePath = options.targetFilePath;
    const auditTrail: VerifiedTaskResult["auditTrail"] = [];

    // Compile Pillar 1-9 compliant envelope
    const pillarConfig: AgentPillarConfig = {
      identity: {
        name: `specialist-${task.specialistRole.toLowerCase().replace(/\s+/g, "-")}`,
        mode: "subagent",
        routingDescription: `Executes ${task.specialistRole} task ${task.id} with strict quality gate enforcement.`,
      },
      runtime: {
        temperature: 0.1,
        maxSteps: 8,
      },
      permissions: {
        allowedTools: task.mcpToolsRequired || ["read_file", "write_file"],
        filesystemAccess: "scoped_write",
        bashAllowed: true,
      },
      scope: {
        includePaths: filePath ? [filePath] : ["apps/**", "packages/**", "libs/**"],
      },
      negativeConstraints: task.constraints,
      ...(options.pillarConfig || {}),
    };

    const pillarPrompt = AgentPillarEnvelope.compileSystemPrompt(
      pillarConfig,
      task.workspaceContext,
    );

    let currentInstructions = task.instructions;
    let lastOutput = "";
    let finalAudit: QualityAuditResult = {
      passed: false,
      score: 0,
      totalChecks: 0,
      criticalViolations: [],
      warnings: [],
      auditTimestamp: new Date().toISOString(),
    };

    for (let iteration = 1; iteration <= maxRetries; iteration++) {
      // Execute subagent turn
      const executionTask: Subtask = {
        ...task,
        instructions: currentInstructions,
        workspaceContext: pillarPrompt,
      };

      lastOutput = await this.coordinator.executeSpecialist(executionTask);

      // Audit output with QualityGate
      finalAudit = QualityGate.auditContent(lastOutput, filePath);
      const feedback = QualityGate.formatDiagnosticFeedback(finalAudit);

      auditTrail.push({
        iteration,
        auditPassed: finalAudit.passed,
        feedback,
      });

      // If QualityGate passes, exit reflection loop immediately
      if (finalAudit.passed) {
        return {
          subtaskId: task.id,
          success: true,
          output: lastOutput,
          iterations: iteration,
          qualityAudit: finalAudit,
          auditTrail,
        };
      }

      // If QualityGate fails and we have remaining iterations, append diagnostic feedback for self-remediation
      if (iteration < maxRetries) {
        currentInstructions = `${task.instructions}

CRITICAL REMEDIATION REQUIRED (Attempt ${iteration} of ${maxRetries}):
Your previous output failed the Quality Gate with the following diagnostic feedback:

${feedback}

Please fix ALL identified critical violations and re-emit the complete, corrected solution without markdown filler.`;
      }
    }

    return {
      subtaskId: task.id,
      success: false,
      output: lastOutput,
      iterations: maxRetries,
      qualityAudit: finalAudit,
      auditTrail,
    };
  }
}
