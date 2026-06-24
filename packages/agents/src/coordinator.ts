import OpenAI from "openai";
import pLimit from "p-limit";

export interface Subtask {
  id: string;
  specialistRole: string;
  instructions: string;
  mcpToolsRequired?: string[];
}

export interface CoordinatorConfig {
  openaiApiKey?: string;
  defaultModel?: string;
  synthesisModel?: string;
  concurrencyLimit?: number;
  temperature?: number;
}

export interface TaskRunResult {
  id: string;
  success: boolean;
  result: string;
}

export class SubagentCoordinator {
  private openai: OpenAI;
  private defaultModel: string;
  private synthesisModel: string;
  private limit: ReturnType<typeof pLimit>;
  private temperature: number;

  constructor(config: CoordinatorConfig = {}) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
    });
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
    this.synthesisModel = config.synthesisModel || "gpt-4o";
    this.limit = pLimit(config.concurrencyLimit || 3);
    this.temperature = config.temperature ?? 0.2;
  }

  /**
   * Run a single specialist subagent with target system role and instructions.
   */
  public async executeSpecialist(task: Subtask): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: "system",
            content: `You are a specialist subagent.
Role: ${task.specialistRole}
Instructions: ${task.instructions}

Your objective is to execute the instructions precisely. Output only the clear, structured results of your task without conversational filler.`,
          },
          {
            role: "user",
            content: task.instructions,
          },
        ],
        temperature: this.temperature,
      });

      return response.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      throw new Error(`Specialist subagent [${task.id}] failed: ${error.message}`);
    }
  }

  /**
   * Orchestrate parallel specialist execution and synthesize the reports.
   */
  public async run(mainGoal: string, subtasks: Subtask[]): Promise<string> {
    // 1. Queue all subtasks with a concurrency limit
    const promises = subtasks.map((task) =>
      this.limit(async (): Promise<TaskRunResult> => {
        try {
          const result = await this.executeSpecialist(task);
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

    return synthesisResponse.choices?.[0]?.message?.content || "";
  }
}
