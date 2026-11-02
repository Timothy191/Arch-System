import { SubagentCoordinator, type Subtask, type TaskRunResult } from './coordinator';
import { SPECIALIST_PERSONAS, type SpecialistPersona } from './specialists';

export const DEFAULT_CONCURRENCY_LIMIT = 3;
export const DEFAULT_TEMPERATURE = 0.2;
export const SYNTHESIS_TEMPERATURE = 0.3;

import { createConcurrencyLimiter, type LimitFunction } from './concurrency';

export { createConcurrencyLimiter, type LimitFunction };

export interface AutonomousSubtask extends Subtask {
  priority?: 'critical' | 'high' | 'normal' | 'low';
  dependsOn?: string[];
  personaKey?: keyof typeof SPECIALIST_PERSONAS;
}

export interface AutonomousPlan {
  goalId: string;
  mainGoal: string;
  subtasks: AutonomousSubtask[];
}

export interface AutonomousSubtaskResult extends TaskRunResult {
  durationMs: number;
  tokensConsumed?: number;
  error?: string;
}

export interface AutonomousPlanExecutionResult {
  goalId: string;
  success: boolean;
  totalDurationMs: number;
  stageCount: number;
  subtaskResults: AutonomousSubtaskResult[];
  synthesis: string;
}

export interface CoordinatorRunOptions {
  sessionId?: string;
  userId?: string;
  concurrencyLimit?: number;
  abortOnCriticalFailure?: boolean;
}

/**
 * Topologically sort subtasks into parallelizable sequential stages based on dependencies.
 */
export function sequenceSubtasks(subtasks: readonly AutonomousSubtask[]): AutonomousSubtask[][] {
  const completedIds = new Set<string>();
  const remaining = [...subtasks];
  const stages: AutonomousSubtask[][] = [];

  while (remaining.length > 0) {
    const readyStage = remaining.filter((task) => {
      if (!task.dependsOn || task.dependsOn.length === 0) return true;
      return task.dependsOn.every((depId) => completedIds.has(depId));
    });

    if (readyStage.length === 0) {
      // Circular dependency detected or unmet external prerequisite; dump remaining to last stage
      stages.push([...remaining]);
      break;
    }

    stages.push(readyStage);
    for (const task of readyStage) {
      completedIds.add(task.id);
      const index = remaining.findIndex((t) => t.id === task.id);
      if (index !== -1) {
        remaining.splice(index, 1);
      }
    }
  }

  return stages;
}

/**
 * Autonomous Coordinator managing multi-agent swarming, dependency sequencing,
 * execution monitoring, and synthesized delivery.
 */
export class AutonomousCoordinator {
  private coordinator: SubagentCoordinator;
  private concurrencyLimit: number;

  constructor(
    options: {
      coordinator?: SubagentCoordinator;
      concurrencyLimit?: number;
    } = {}
  ) {
    this.coordinator = options.coordinator ?? new SubagentCoordinator();
    this.concurrencyLimit = options.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT;
  }

  /**
   * Resolves the appropriate SpecialistPersona for a subtask.
   */
  public resolvePersona(subtask: Readonly<AutonomousSubtask>): SpecialistPersona | null {
    if (!subtask.personaKey) return null;
    const persona = SPECIALIST_PERSONAS[subtask.personaKey];
    return persona ? persona : null;
  }

  /**
   * Executes an autonomous multi-stage plan respecting dependency constraints and error policies.
   */
  public async executePlan(
    plan: Readonly<AutonomousPlan>,
    options: CoordinatorRunOptions = {}
  ): Promise<AutonomousPlanExecutionResult> {
    const startTime = Date.now();
    const stages = sequenceSubtasks(plan.subtasks);
    const subtaskResults: AutonomousSubtaskResult[] = [];
    const limit = createConcurrencyLimiter(options.concurrencyLimit ?? this.concurrencyLimit);

    let planSuccess = true;

    for (const stage of stages) {
      const stagePromises = stage.map((task) =>
        limit(async (): Promise<AutonomousSubtaskResult> => {
          const taskStart = Date.now();
          const persona = this.resolvePersona(task);

          const enrichedTask: Subtask = {
            ...task,
            specialistRole: persona?.role ?? task.specialistRole,
            constraints: [...(task.constraints ?? []), ...(persona?.constraints ?? [])],
          };

          try {
            const output = await this.coordinator.executeSpecialist(enrichedTask);
            return {
              id: task.id,
              success: true,
              result: output,
              durationMs: Date.now() - taskStart,
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown execution failure';
            return {
              id: task.id,
              success: false,
              result: errorMessage,
              error: errorMessage,
              durationMs: Date.now() - taskStart,
            };
          }
        })
      );

      const stageResults = await Promise.all(stagePromises);
      subtaskResults.push(...stageResults);

      const hasCriticalFailure = stageResults.some((result) => {
        const matchingTask = stage.find((t) => t.id === result.id);
        return !result.success && matchingTask?.priority === 'critical';
      });

      if (hasCriticalFailure) {
        planSuccess = false;
        if (options.abortOnCriticalFailure !== false) {
          break;
        }
      }
    }

    // Synthesize outputs
    const reports = subtaskResults
      .map(
        (r) =>
          `[Subtask ${r.id}] Status: ${r.success ? 'SUCCESS' : 'FAILED'} (${r.durationMs}ms)\n${r.result}`
      )
      .join('\n\n──────────────────────────────────────\n\n');

    let synthesis = '';
    try {
      synthesis = await this.coordinator.run(plan.mainGoal, plan.subtasks, {
        sessionId: options.sessionId,
        userId: options.userId,
      });
    } catch {
      synthesis = `Autonomous Coordinator Plan Summary for Goal [${plan.goalId}]:\n\n${reports}`;
    }

    return {
      goalId: plan.goalId,
      success: planSuccess && subtaskResults.every((r) => r.success),
      totalDurationMs: Date.now() - startTime,
      stageCount: stages.length,
      subtaskResults,
      synthesis,
    };
  }
}
