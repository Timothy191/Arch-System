import OpenAI from "openai";
import pLimit from "p-limit";
import { type Langfuse, type LangfuseTraceClient } from "langfuse";
import { getLangfuseClient, type LangfuseConfig } from "./langfuse.js";

export interface Subtask {
  id: string;
  specialistRole: string;
  instructions: string;
  steps?: string[];
  expectation?: string;
  constraints?: string[];
  workspaceContext?: string;
  mcpToolsRequired?: string[];
}

export interface CoordinatorConfig {
  openaiApiKey?: string;
  defaultModel?: string;
  synthesisModel?: string;
  concurrencyLimit?: number;
  temperature?: number;
  langfuse?: LangfuseConfig;
}

export interface TaskRunResult {
  id: string;
  success: boolean;
  result: string;
}

export interface RunOptions {
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class SubagentCoordinator {
  private openai: OpenAI;
  private defaultModel: string;
  private synthesisModel: string;
  private limit: ReturnType<typeof pLimit>;
  private temperature: number;
  private langfuse: Langfuse | null;

  constructor(config: CoordinatorConfig = {}) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
    });
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
    this.synthesisModel = config.synthesisModel || "gpt-4o";
    this.limit = pLimit(config.concurrencyLimit || 3);
    this.temperature = config.temperature ?? 0.2;
    this.langfuse = getLangfuseClient(config.langfuse);
  }

  /**
   * Run a single specialist subagent with target system role and instructions
   * formatted via the RISEN prompt engineering protocol.
   */
  public async executeSpecialist(
    task: Subtask,
    parentTrace?: LangfuseTraceClient,
  ): Promise<string> {
    const generation = parentTrace?.generation({
      name: `specialist-${task.specialistRole}`,
      model: this.defaultModel,
      modelParameters: {
        temperature: this.temperature,
      },
      input: {
        role: task.specialistRole,
        instructions: task.instructions,
        steps: task.steps,
        expectation: task.expectation,
        constraints: task.constraints,
      },
      metadata: {
        subtaskId: task.id,
        specialistRole: task.specialistRole,
        workspaceContext: task.workspaceContext,
        mcpToolsRequired: task.mcpToolsRequired || [],
      },
    });

    const systemPrompt = `<role>
${task.specialistRole}
</role>
<instructions>
${task.instructions}
</instructions>
${task.steps && task.steps.length > 0 ? `<steps>\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n</steps>` : ""}
${task.expectation ? `<expectation>\n${task.expectation}\n</expectation>` : "<expectation>\nProvide structured, production-grade output without conversational filler.\n</expectation>"}
${task.constraints && task.constraints.length > 0 ? `<constraints>\n${task.constraints.map((c) => `- ${c}`).join("\n")}\n</constraints>` : "<constraints>\n- Zero stubs or placeholders.\n- Strict adherence to monorepo and XDG standards.\n</constraints>"}
${task.workspaceContext ? `<context>\n${task.workspaceContext}\n</context>` : ""}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: task.instructions,
          },
        ],
        temperature: this.temperature,
      });

      const outputContent = response.choices?.[0]?.message?.content || "";

      generation?.end({
        output: outputContent,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      });

      return outputContent;
    } catch (error: any) {
      generation?.end({
        statusMessage: error.message,
        level: "ERROR",
      });
      throw new Error(`Specialist subagent [${task.id}] failed: ${error.message}`);
    }
  }

  /**
   * Orchestrate parallel specialist execution and synthesize the reports.
   * AGENT-TRACE: Root trace captures multi-agent orchestration lifecycle, per-subagent spans, and final synthesis.
   */
  public async run(mainGoal: string, subtasks: Subtask[], options?: RunOptions): Promise<string> {
    const trace = this.langfuse?.trace({
      name: "subagent-orchestrator",
      input: { mainGoal, subtaskCount: subtasks.length },
      sessionId: options?.sessionId,
      userId: options?.userId,
      tags: ["agent-coordinator", "multi-agent", ...(options?.tags || [])],
      metadata: options?.metadata,
    });

    // 1. Queue all subtasks with a concurrency limit
    const promises = subtasks.map((task) =>
      this.limit(async (): Promise<TaskRunResult> => {
        try {
          const result = await this.executeSpecialist(task, trace);
          return { id: task.id, success: true, result };
        } catch (error: any) {
          return { id: task.id, success: false, result: error.message };
        }
      }),
    );

    const completed = await Promise.all(promises);

    // 2. Synthesize results
    const reports = completed
      .map(
        (t) =>
          `[Subtask ${t.id}] Status: ${t.success ? "SUCCESS" : "FAILED"}\nReport:\n${t.result}`,
      )
      .join("\n\n──────────────────────────────────────\n\n");

    const synthesisGeneration = trace?.generation({
      name: "orchestrator-synthesis",
      model: this.synthesisModel,
      modelParameters: { temperature: 0.3 },
      input: { mainGoal, reports },
    });

    try {
      const synthesisResponse = await this.openai.chat.completions.create({
        model: this.synthesisModel,
        messages: [
          {
            role: "system",
            content: `You are the Lead Orchestrator.
Your goal: Synthesize the specialist reports into a single, cohesive, high-quality final document.
Keep the layout logical, remove redundant sections, and clearly highlight any failed subtasks if critical.`,
          },
          {
            role: "user",
            content: `Main Goal: ${mainGoal}\n\nSpecialist Reports:\n${reports}`,
          },
        ],
        temperature: 0.3,
      });

      const finalContent = synthesisResponse.choices?.[0]?.message?.content || "";

      synthesisGeneration?.end({
        output: finalContent,
        usage: {
          promptTokens: synthesisResponse.usage?.prompt_tokens,
          completionTokens: synthesisResponse.usage?.completion_tokens,
          totalTokens: synthesisResponse.usage?.total_tokens,
        },
      });

      trace?.update({
        output: finalContent,
      });

      await this.langfuse?.flushAsync();
      return finalContent;
    } catch (error: any) {
      synthesisGeneration?.end({
        statusMessage: error.message,
        level: "ERROR",
      });
      await this.langfuse?.flushAsync();
      throw error;
    }
  }
}
