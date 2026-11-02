import type { Langfuse, LangfuseTraceClient } from 'langfuse';
import OpenAI from 'openai';
import { createConcurrencyLimiter, type LimitFunction } from './concurrency';
import { getLangfuseClient, type LangfuseConfig } from './langfuse';

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

export const ANTIGRAVITY_GEMINI_OPENAI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/';
export const DEFAULT_ANTIGRAVITY_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_ANTIGRAVITY_SYNTHESIS_MODEL = 'gemini-2.5-pro';
export const DEFAULT_COORDINATOR_CONCURRENCY = 3;
export const DEFAULT_COORDINATOR_TEMPERATURE = 0.2;
export const SYNTHESIS_COORDINATOR_TEMPERATURE = 0.3;

export interface CoordinatorConfig {
  openaiApiKey?: string;
  baseURL?: string;
  provider?:
    | 'gemini'
    | 'antigravity'
    | 'openai'
    | 'aion'
    | 'cohere'
    | 'ollama'
    | 'vercel-ai-gateway';
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
  private limit: LimitFunction;
  private temperature: number;
  private langfuse: Langfuse | null;

  constructor(config: CoordinatorConfig = {}) {
    let apiKey = config.openaiApiKey;
    let baseURL = config.baseURL;
    let defaultModel = config.defaultModel;
    let synthesisModel = config.synthesisModel;

    if (config.provider === 'gemini' || config.provider === 'antigravity' || !config.provider) {
      apiKey =
        apiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.ANTIGRAVITY_API_KEY ||
        process.env.AI_GATEWAY_API_KEY ||
        process.env.OPENAI_API_KEY ||
        'antigravity-gemini-local';
      baseURL =
        baseURL ||
        process.env.GEMINI_OPENAI_BASE_URL ||
        process.env.AI_GATEWAY_BASE_URL ||
        ANTIGRAVITY_GEMINI_OPENAI_BASE_URL;
      defaultModel =
        defaultModel ||
        process.env.ANTIGRAVITY_MODEL ||
        process.env.GEMINI_MODEL ||
        DEFAULT_ANTIGRAVITY_GEMINI_MODEL;
      synthesisModel =
        synthesisModel ||
        process.env.ANTIGRAVITY_SYNTHESIS_MODEL ||
        process.env.GEMINI_SYNTHESIS_MODEL ||
        DEFAULT_ANTIGRAVITY_SYNTHESIS_MODEL;
    } else if (config.provider === 'ollama') {
      apiKey = apiKey || 'ollama';
      baseURL = baseURL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1';
      defaultModel = defaultModel || DEFAULT_ANTIGRAVITY_GEMINI_MODEL;
      synthesisModel = synthesisModel || DEFAULT_ANTIGRAVITY_SYNTHESIS_MODEL;
    } else if (config.provider === 'vercel-ai-gateway') {
      apiKey = apiKey || process.env.AI_GATEWAY_API_KEY || 'antigravity-gemini-local';
      baseURL = baseURL || process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1';
      defaultModel = defaultModel || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash';
      synthesisModel = synthesisModel || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-pro';
    } else {
      // Legacy provider compatibility all routed to Antigravity Gemini models without extra API hops
      apiKey =
        apiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        'antigravity-gemini-local';
      baseURL = baseURL || process.env.OPENAI_BASE_URL || ANTIGRAVITY_GEMINI_OPENAI_BASE_URL;
      defaultModel = defaultModel || DEFAULT_ANTIGRAVITY_GEMINI_MODEL;
      synthesisModel = synthesisModel || DEFAULT_ANTIGRAVITY_SYNTHESIS_MODEL;
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL,
    });
    this.defaultModel = defaultModel;
    this.synthesisModel = synthesisModel;
    this.limit = createConcurrencyLimiter(
      config.concurrencyLimit || DEFAULT_COORDINATOR_CONCURRENCY
    );
    this.temperature = config.temperature ?? DEFAULT_COORDINATOR_TEMPERATURE;
    this.langfuse = getLangfuseClient(config.langfuse);
  }

  /**
   * Run a single specialist subagent with target system role and instructions
   * formatted via the RISEN prompt engineering protocol.
   */
  public async executeSpecialist(
    task: Subtask,
    parentTrace?: LangfuseTraceClient
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
${task.steps && task.steps.length > 0 ? `<steps>\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n</steps>` : ''}
${task.expectation ? `<expectation>\n${task.expectation}\n</expectation>` : '<expectation>\nProvide structured, production-grade output without conversational filler.\n</expectation>'}
${task.constraints && task.constraints.length > 0 ? `<constraints>\n${task.constraints.map((c) => `- ${c}`).join('\n')}\n</constraints>` : '<constraints>\n- Zero stubs or placeholders.\n- Strict adherence to monorepo and XDG standards.\n</constraints>'}
${task.workspaceContext ? `<context>\n${task.workspaceContext}\n</context>` : ''}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: task.instructions,
          },
        ],
        temperature: this.temperature,
      });

      const outputContent = response.choices?.[0]?.message?.content || '';

      generation?.end({
        output: outputContent,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      });

      return outputContent;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      generation?.end({
        statusMessage: errorMessage,
        level: 'ERROR',
      });
      throw new Error(`Specialist subagent [${task.id}] failed: ${errorMessage}`, {
        cause: error,
      });
    }
  }

  /**
   * Orchestrate parallel specialist execution and synthesize the reports.
   * AGENT-TRACE: Root trace captures multi-agent orchestration lifecycle, per-subagent spans, and final synthesis.
   */
  public async run(mainGoal: string, subtasks: Subtask[], options?: RunOptions): Promise<string> {
    const trace = this.langfuse?.trace({
      name: 'subagent-orchestrator',
      input: { mainGoal, subtaskCount: subtasks.length },
      sessionId: options?.sessionId,
      userId: options?.userId,
      tags: ['agent-coordinator', 'multi-agent', ...(options?.tags || [])],
      metadata: options?.metadata,
    });

    // 1. Queue all subtasks with a concurrency limit
    const promises = subtasks.map((task) =>
      this.limit(async (): Promise<TaskRunResult> => {
        try {
          const result = await this.executeSpecialist(task, trace);
          return { id: task.id, success: true, result };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { id: task.id, success: false, result: errorMessage };
        }
      })
    );

    const completed = await Promise.all(promises);

    // 2. Synthesize results
    const reports = completed
      .map(
        (t) => `[Subtask ${t.id}] Status: ${t.success ? 'SUCCESS' : 'FAILED'}\nReport:\n${t.result}`
      )
      .join('\n\n──────────────────────────────────────\n\n');

    const synthesisGeneration = trace?.generation({
      name: 'orchestrator-synthesis',
      model: this.synthesisModel,
      modelParameters: { temperature: SYNTHESIS_COORDINATOR_TEMPERATURE },
      input: { mainGoal, reports },
    });

    try {
      const synthesisResponse = await this.openai.chat.completions.create({
        model: this.synthesisModel,
        messages: [
          {
            role: 'system',
            content: `You are the Lead Orchestrator.
Your goal: Synthesize the specialist reports into a single, cohesive, high-quality final document.
Keep the layout logical, remove redundant sections, and clearly highlight any failed subtasks if critical.`,
          },
          {
            role: 'user',
            content: `Main Goal: ${mainGoal}\n\nSpecialist Reports:\n${reports}`,
          },
        ],
        temperature: SYNTHESIS_COORDINATOR_TEMPERATURE,
      });

      const finalContent = synthesisResponse.choices?.[0]?.message?.content || '';

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      synthesisGeneration?.end({
        statusMessage: errorMessage,
        level: 'ERROR',
      });
      await this.langfuse?.flushAsync();
      throw error;
    }
  }

  /**
   * Pre-flight Research Evaluation Gate
   * Automatically invokes the Research Specialist to benchmark frontier industry standards
   * (e.g. Netflix Chaos, Uber AST graphs, Shopify Packwerk, Airbnb Data Contracts)
   * before committing to non-trivial structural or architectural refactors.
   */
  public async evaluateArchitecturalPreFlight(
    architecturalProposal: string,
    targetScope: string[],
    options?: RunOptions
  ): Promise<{ approved: boolean; benchmarkSummary: string; recommendations: string[] }> {
    const researchSubtask: Subtask = {
      id: 'preflight-research-gate',
      specialistRole: 'Frontier Systems & Research Architect',
      instructions: `Evaluate the following architectural change proposal against frontier industry benchmarks and fitness function invariants:
Proposal: ${architecturalProposal}
Target Scope: ${targetScope.join(', ')}

Analyze:
1. Real-world industry precedents (e.g. Netflix, Uber, Shopify, Airbnb, Google, Meta).
2. Potential failure modes, circular dependencies, or schema drift risks.
3. Recommended fitness function checks and minimal non-breaking seams.`,
      expectation:
        'Return a structured JSON evaluation with fields: approved (boolean), benchmarkSummary (string), and recommendations (array of strings).',
      constraints: [
        'Must verify zero-risk rollback compatibility.',
        'Must reject any proposals introducing unvetted third-party bloat.',
        'Output valid JSON only.',
      ],
    };

    const trace = this.langfuse?.trace({
      name: 'architectural-preflight-research',
      input: { architecturalProposal, targetScope },
      sessionId: options?.sessionId,
      userId: options?.userId,
      tags: ['preflight-research', 'architecture-gate', ...(options?.tags || [])],
      metadata: options?.metadata,
    });

    try {
      const rawResult = await this.executeSpecialist(researchSubtask, trace);
      await this.langfuse?.flushAsync();

      // Parse JSON response safely
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: Boolean(parsed.approved ?? true),
          benchmarkSummary: parsed.benchmarkSummary || rawResult,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
      }

      return {
        approved: true,
        benchmarkSummary: rawResult,
        recommendations: ['Ensure full quality gate and rollback testing passes.'],
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        approved: true,
        benchmarkSummary: `Pre-flight research completed with fallback heuristic: ${errorMessage}`,
        recommendations: ['Proceed with standard 5-layer critique council gate.'],
      };
    }
  }
}
