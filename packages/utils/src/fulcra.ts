import { promisify } from 'util';

const execAsync = async (cmd: string) => {
  if (typeof window !== 'undefined') throw new Error('Cannot run exec on client');
  const { exec } = eval('require')('child_process');
  return promisify(exec)(cmd);
};

/**
 * AgentCursorTracker
 * Wrapper for the Fulcra API to push and retrieve the agent's checkpoint state.
 */
export class AgentCursorTracker {
  /**
   * Records a new checkpoint for the agent using the Fulcra CLI
   * @param task Name of the current task
   * @param state State of the current task
   */
  static async recordState(task: string, state: string): Promise<void> {
    try {
      // Tags are parsed/stored by Fulcra, which is useful for filtering later
      const cmd = `uvx fulcra-api record AgentCursor --tag "task:${task}" --tag "state:${state}"`;
      await execAsync(cmd);
      console.log(`[AgentCursor] Checkpoint recorded: task=${task}, state=${state}`);
    } catch (err) {
      console.error(`[AgentCursor] Failed to record state:`, err);
    }
  }

  /**
   * Gets the raw latest record
   */
  static async getLatestRaw(): Promise<any> {
    try {
      const { stdout } = await execAsync(`uvx fulcra-api get-records AgentCursor latest`);
      if (!stdout.trim()) return null;

      const records = stdout
        .trim()
        .split('\n')
        .map((r: any) => JSON.parse(r));
      return records.length > 0 ? records[0] : null;
    } catch (err) {
      console.error(`[AgentCursor] Failed to get latest record:`, err);
      return null;
    }
  }

  /**
   * Fetches recent life context for the Assistant (e.g., Sleep and Location)
   * This is used to build a context-aware system prompt.
   * @param timeRange e.g., "1 day"
   */
  static async getLifeContext(timeRange: string = '1 day'): Promise<any> {
    const context: any = {};
    try {
      // 1. Fetch recent sleep
      const { stdout: sleepOut } = await execAsync(`uvx fulcra-api sleep-cycles "${timeRange}"`);
      if (sleepOut.trim()) {
        context.sleep = sleepOut
          .trim()
          .split('\n')
          .map((r: any) => JSON.parse(r));
      }

      // 2. Fetch recent location
      const { stdout: locOut } = await execAsync(`uvx fulcra-api location-at-time latest`);
      if (locOut.trim()) {
        context.location = JSON.parse(locOut.trim());
      }
    } catch (err) {
      console.error(`[LifeContext] Failed to fetch life context:`, err);
    }
    return context;
  }
}
