import { createLogger } from '@repo/logger';
import {
  Agent,
  type AgentMessage,
  type AgentTurnOutcome,
  type AgentTurnRunner,
  DEFAULT_MAX_HANDOFFS,
  runSwarm,
  type ToolResult,
} from './index';

interface TestContext {
  departmentId: string;
}

const context: TestContext = { departmentId: 'dept-456' };

/**
 * A real logger instance silenced at runtime, so the suite emits no pino output while
 * still exercising the `logger` injection seam with the genuine concrete type.
 */
const silentLogger = createLogger('swarm-test');
silentLogger.level = 'silent';

const complete = (by: string): AgentTurnOutcome<TestContext> => ({
  kind: 'complete',
  message: { role: 'assistant', content: `Task completed by ${by}` },
});

const handoffTo = (target: Agent<TestContext>, reason: string): AgentTurnOutcome<TestContext> => ({
  kind: 'handoff',
  to: target,
  reason,
});

describe('Swarm Orchestration Engine', () => {
  const databaseArchitect = new Agent<TestContext>(
    'DatabaseArchitect',
    'You are the principal DBA.'
  );

  it('completes a single agent turn without any handoff', async () => {
    const simpleAgent = new Agent<TestContext>('SimpleAgent', 'Do a simple task');
    const result = await runSwarm({
      startingAgent: simpleAgent,
      context,
      runTurn: async () => complete(simpleAgent.name),
      logger: silentLogger,
    });

    expect(result.finalAgent).toBe(simpleAgent);
    expect(result.handoffs).toBe(0);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe('Task completed by SimpleAgent');
  });

  it('advances to the handoff target returned by a turn', async () => {
    const uiEngineer = new Agent<TestContext>('UIEngineer', 'You build React components.');
    const runTurn: AgentTurnRunner<TestContext> = async (agent) =>
      agent.name === 'UIEngineer'
        ? handoffTo(databaseArchitect, 'schema change required')
        : complete(agent.name);

    const result = await runSwarm({
      startingAgent: uiEngineer,
      context,
      runTurn,
      logger: silentLogger,
    });

    expect(result.finalAgent).toBe(databaseArchitect);
    expect(result.handoffs).toBe(1);
    expect(result.halted).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe('Task completed by DatabaseArchitect');
  });

  it('halts at maxHandoffs when every turn keeps requesting a handoff', async () => {
    const maxHandoffs = 3;
    const a = new Agent<TestContext>('AgentA', 'A');
    const b = new Agent<TestContext>('AgentB', 'B');
    let invocations = 0;

    // A runner that never completes: it always bounces control to the other agent.
    const runTurn: AgentTurnRunner<TestContext> = async (agent) => {
      invocations += 1;
      return handoffTo(agent.name === 'AgentA' ? b : a, 'circular handoff');
    };

    const result = await runSwarm({
      startingAgent: a,
      context,
      runTurn,
      maxHandoffs,
      logger: silentLogger,
    });

    expect(result.halted).toBe(true);
    expect(result.handoffs).toBe(maxHandoffs);
    // The budget is only discoverable by running a turn, so the terminal turn still executes.
    expect(invocations).toBe(maxHandoffs + 1);
    // Halting is not completion: no assistant message is appended.
    expect(result.messages).toHaveLength(0);
  });

  it('honours a zero handoff budget by letting the first turn run then halting', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');

    const result = await runSwarm({
      startingAgent: a,
      context,
      runTurn: async () => handoffTo(databaseArchitect, 'wants to delegate'),
      maxHandoffs: 0,
      logger: silentLogger,
    });

    expect(result.halted).toBe(true);
    expect(result.handoffs).toBe(0);
    expect(result.finalAgent).toBe(a);
    expect(result.messages).toHaveLength(0);
  });

  it('defaults the handoff budget to DEFAULT_MAX_HANDOFFS', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');
    const b = new Agent<TestContext>('AgentB', 'B');

    const result = await runSwarm({
      startingAgent: a,
      context,
      runTurn: async (agent) => handoffTo(agent.name === 'AgentA' ? b : a, 'circular'),
      logger: silentLogger,
    });

    expect(result.handoffs).toBe(DEFAULT_MAX_HANDOFFS);
    expect(result.halted).toBe(true);
  });

  it('rejects a negative or fractional handoff budget', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');
    const runTurn: AgentTurnRunner<TestContext> = async () => complete(a.name);

    await expect(
      runSwarm({ startingAgent: a, context, runTurn, maxHandoffs: -1, logger: silentLogger })
    ).rejects.toThrow(RangeError);

    await expect(
      runSwarm({ startingAgent: a, context, runTurn, maxHandoffs: 1.5, logger: silentLogger })
    ).rejects.toThrow(RangeError);
  });

  it('does not mutate the seed transcript', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');
    const seed: readonly AgentMessage[] = [{ role: 'user', content: 'seed' }];

    const result = await runSwarm({
      startingAgent: a,
      context,
      messages: seed,
      runTurn: async () => complete(a.name),
      logger: silentLogger,
    });

    expect(seed).toHaveLength(1);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.content).toBe('seed');
  });

  it('resolves dynamic instructions from the run context', () => {
    const agent = new Agent<TestContext>(
      'UIEngineer',
      (ctx) => `Build components for department ${ctx.departmentId}.`
    );

    expect(agent.instructionsFor(context)).toBe('Build components for department dept-456.');
  });

  it('routes through a tool that returns a handoff rather than a name comparison', async () => {
    const dbTool = {
      name: 'request_schema_change',
      description: 'Escalate to the database architect.',
      execute: async (): Promise<ToolResult<TestContext>> => ({
        kind: 'handoff',
        target: databaseArchitect,
        reason: 'needs a schema migration',
      }),
    };
    const uiEngineer = new Agent<TestContext>('UIEngineer', 'You build React components.', [
      dbTool,
    ]);

    // The runner dispatches the agent's tools and surfaces a handoff outcome.
    const runTurn: AgentTurnRunner<TestContext> = async (agent) => {
      const tool = agent.tools[0];
      if (!tool) return complete(agent.name);
      const toolResult = await tool.execute(context);
      return toolResult.kind === 'handoff'
        ? handoffTo(toolResult.target, toolResult.reason)
        : complete(agent.name);
    };

    const result = await runSwarm({
      startingAgent: uiEngineer,
      context,
      runTurn,
      logger: silentLogger,
    });

    expect(result.finalAgent).toBe(databaseArchitect);
    expect(result.handoffs).toBe(1);
  });

  it('emits handoff telemetry in pino (bindings, message) order', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');
    const b = new Agent<TestContext>('AgentB', 'B');
    const infoSpy = jest.spyOn(silentLogger, 'info');

    await runSwarm({
      startingAgent: a,
      context,
      maxHandoffs: 1,
      logger: silentLogger,
      runTurn: async (agent) =>
        agent.name === 'AgentA' ? handoffTo(b, 'needs the DBA') : complete(agent.name),
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      { from: 'AgentA', to: 'AgentB', reason: 'needs the DBA', handoffs: 1 },
      'swarm.handoff'
    );

    infoSpy.mockRestore();
  });

  it('warns with the attempted target when the handoff budget is exhausted', async () => {
    const a = new Agent<TestContext>('AgentA', 'A');
    const b = new Agent<TestContext>('AgentB', 'B');
    const warnSpy = jest.spyOn(silentLogger, 'warn');

    await runSwarm({
      startingAgent: a,
      context,
      maxHandoffs: 0,
      logger: silentLogger,
      runTurn: async () => handoffTo(b, 'circular'),
    });

    expect(warnSpy).toHaveBeenCalledWith(
      { agent: 'AgentA', attemptedTarget: 'AgentB', maxHandoffs: 0 },
      'swarm.run.halted'
    );

    warnSpy.mockRestore();
  });
});
