/**
 * @file swarm/index.ts
 * @description Lightweight, code-first agent handoff engine (OpenAI Swarm paradigm).
 *
 * Orchestration is deliberately separated from execution. `runSwarm` owns the handoff
 * loop, the handoff budget, and transcript bookkeeping; the model call itself is
 * supplied by the caller as an {@link AgentTurnRunner}. That keeps the loop
 * deterministic and testable without a live provider, and keeps provider SDKs out of
 * the orchestration layer.
 */

import { serverLogger } from '@repo/logger';

/** Roles a message can carry within a swarm transcript. */
export type AgentRole = 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  role: AgentRole;
  content: string;
  /** Set when `role` is `tool`; names the tool that produced `content`. */
  toolName?: string;
}

/**
 * Outcome of invoking a single tool. A tool returning `handoff` transfers control to
 * `target` — this is the mechanism the Swarm paradigm uses for agent routing, as
 * opposed to inspecting agent names or instruction text.
 */
export type ToolResult<TContext> =
  | { readonly kind: 'handoff'; readonly target: Agent<TContext>; readonly reason: string }
  | { readonly kind: 'data'; readonly content: string };

export interface AgentTool<TContext = unknown> {
  readonly name: string;
  readonly description: string;
  readonly execute: (context: TContext) => Promise<ToolResult<TContext>>;
}

export class Agent<TContext = unknown> {
  constructor(
    public readonly name: string,
    public readonly instructions: string | ((context: TContext) => string),
    public readonly tools: readonly AgentTool<TContext>[] = []
  ) {}

  /** Resolves instruction text for a run context, honouring dynamic instructions. */
  public instructionsFor(context: TContext): string {
    return typeof this.instructions === 'function' ? this.instructions(context) : this.instructions;
  }
}

/** A handoff target is simply another agent. */
export type Handoff<TContext = unknown> = Agent<TContext>;

/**
 * Result of one agent turn: either the swarm advances to `to`, or the agent produced a
 * final `message` and the run ends.
 */
export type AgentTurnOutcome<TContext> =
  | { readonly kind: 'handoff'; readonly to: Agent<TContext>; readonly reason: string }
  | { readonly kind: 'complete'; readonly message: AgentMessage };

/**
 * Executes exactly one turn for `agent`. Supplied by the caller so the model/provider
 * stays out of the orchestration layer.
 */
export type AgentTurnRunner<TContext> = (
  agent: Agent<TContext>,
  messages: readonly AgentMessage[],
  context: TContext
) => Promise<AgentTurnOutcome<TContext>>;

export interface SwarmRunOptions<TContext> {
  startingAgent: Agent<TContext>;
  context: TContext;
  runTurn: AgentTurnRunner<TContext>;
  /** Seed transcript. Never mutated. */
  messages?: readonly AgentMessage[];
  /** Hard cap on handoffs performed in one run. Defaults to {@link DEFAULT_MAX_HANDOFFS}. */
  maxHandoffs?: number;
  /**
   * Injected logger. Defaults to `@repo/logger`'s server logger; tests substitute a
   * silenced instance. Typed as the concrete logger so pino's `(bindings, message)`
   * call convention is preserved.
   */
  logger?: typeof serverLogger;
}

export interface SwarmRunResult<TContext> {
  messages: AgentMessage[];
  finalAgent: Agent<TContext>;
  /** Number of handoffs actually performed. */
  handoffs: number;
  /** True when the run stopped on the handoff budget rather than on completion. */
  halted: boolean;
}

export const DEFAULT_MAX_HANDOFFS = 5;

/**
 * Runs the handoff loop until an agent completes or the handoff budget is exhausted.
 *
 * `runTurn` is invoked at most `maxHandoffs + 1` times: a turn must execute in order to
 * discover whether it requests a handoff, so the terminal turn is always performed.
 * `halted` is true exactly when a handoff was requested with no budget remaining.
 */
export async function runSwarm<TContext>(
  options: SwarmRunOptions<TContext>
): Promise<SwarmRunResult<TContext>> {
  const { startingAgent, context, runTurn, maxHandoffs = DEFAULT_MAX_HANDOFFS } = options;
  const logger = options.logger ?? serverLogger;

  if (!Number.isInteger(maxHandoffs) || maxHandoffs < 0) {
    throw new RangeError(`maxHandoffs must be a non-negative integer, received ${maxHandoffs}`);
  }

  const messages: AgentMessage[] = [...(options.messages ?? [])];
  let currentAgent = startingAgent;
  let handoffs = 0;

  logger.debug(
    { agent: currentAgent.name, maxHandoffs, transcriptLength: messages.length },
    'swarm.run.start'
  );

  while (true) {
    const outcome = await runTurn(currentAgent, messages, context);

    if (outcome.kind === 'complete') {
      messages.push(outcome.message);
      logger.debug({ agent: currentAgent.name, handoffs }, 'swarm.run.complete');
      return { messages, finalAgent: currentAgent, handoffs, halted: false };
    }

    if (handoffs >= maxHandoffs) {
      logger.warn(
        { agent: currentAgent.name, attemptedTarget: outcome.to.name, maxHandoffs },
        'swarm.run.halted'
      );
      return { messages, finalAgent: currentAgent, handoffs, halted: true };
    }

    handoffs += 1;
    logger.info(
      { from: currentAgent.name, to: outcome.to.name, reason: outcome.reason, handoffs },
      'swarm.handoff'
    );
    currentAgent = outcome.to;
  }
}
