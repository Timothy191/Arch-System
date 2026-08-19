// Jest stub for `cloudflare:workers` (Workers-runtime-only module).
// Exposes the same base-class shapes the production code imports so unit
// tests can exercise workflow logic without booting the Workers runtime.
// `ExecutionContext` is part of the ambient Workers types pulled in via
// `@cloudflare/workers-types`, so we rely on the global declaration here.

export class WorkflowEntrypoint<Env = unknown, TPayload = unknown> {
  constructor(
    _ctx: ExecutionContext | undefined,
    public readonly env: Env,
  ) {}
  async run(_event: WorkflowEvent<TPayload>, _step: WorkflowStep): Promise<unknown> {
    throw new Error("WorkflowEntrypoint.run must be implemented by subclass");
  }
}

export class WorkflowEvent<TPayload = unknown> {
  readonly payload: TPayload;
  readonly timestamp: Date;
  readonly instanceId: string;
  constructor(payload: TPayload) {
    this.payload = payload;
    this.timestamp = new Date();
    this.instanceId = "test-instance";
  }
}

export interface WorkflowStepConfig {
  retries?: { limit: number; delay: string | number; backoff?: string };
  timeout?: string | number;
}

export class WorkflowStep {
  async do<T>(
    _name: string,
    _callback: () => Promise<T>,
    _config?: WorkflowStepConfig,
  ): Promise<T> {
    throw new Error("WorkflowStep.do must be invoked via test double");
  }
}
