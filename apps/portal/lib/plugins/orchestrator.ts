import { ArchPlugin, PluginHooks, PluginWidget } from "./types";
import {
  NotFoundError,
  APIError,
  ConflictError,
} from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import { interpret, type ActorRefFrom } from "xstate";
import { orchestratorMachine, type HealthReport } from "./machines";

/**
 * PluginOrchestrator - XState-powered plugin lifecycle management
 *
 * Refactored to use XState actor model for robust state management.
 * Maintains backward-compatible public API while using state machines internally.
 */
class PluginOrchestrator {
  private actor: ActorRefFrom<typeof orchestratorMachine>;
  private isClient: boolean;

  constructor() {
    this.isClient = typeof window !== "undefined";

    // Create XState actor
    this.actor = interpret(orchestratorMachine, {
      systemId: "plugin-system",
    });

    // Subscribe to state changes for debugging
    this.actor.subscribe((snapshot) => {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[PluginOrchestrator] State: ${snapshot.value}`, {
          plugins: snapshot.context.healthReport.activeCount,
          failed: snapshot.context.healthReport.failedCount,
        });
      }
    });

    // Start the actor
    if (!this.isClient) {
      this.actor.start();
      this.actor.send({ type: "INITIALIZE" });

      // Auto-load plugins
      this.loadAllPlugins().catch((err) => {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: "plugin_autoload_critical",
        });
      });
    }
  }

  /**
   * Scans and loads all configured plugins dynamically.
   * Idempotent - safe to call multiple times.
   */
  public async loadAllPlugins(): Promise<void> {
    if (this.isClient) return;

    const snapshot = this.actor.getSnapshot();
    if (snapshot.context.isInitialized && snapshot.value === "active") {
      return; // Already loaded
    }

    // Send load command to orchestrator machine
    this.actor.send({ type: "LOAD_PLUGINS" });

    // Wait for loading to complete (poll with timeout)
    const maxWait = 10000; // 10 seconds max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const current = this.actor.getSnapshot();
      if (current.value === "active") {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    throw new ConflictError("Plugin loading timeout exceeded", {
      resource: "plugin_orchestrator",
    });
  }

  /**
   * Sandboxed Engine Execution.
   * Runs custom plugin mathematical or data algorithms safely.
   */
  public async executeEngine(
    pluginId: string,
    params?: Record<string, any>,
  ): Promise<Record<string, any>> {
    // Find plugin from XState context
    const snapshot = this.actor.getSnapshot();
    const pluginActor = snapshot.context.plugins.get(pluginId);

    if (!pluginActor) {
      throw new NotFoundError(
        `Active engine for plugin ID [${pluginId}] not found.`,
        {
          resource: "plugin_engine",
          id: pluginId,
        },
      );
    }

    // Get plugin data from actor
    const pluginSnapshot = pluginActor.getSnapshot();
    if (pluginSnapshot.status !== "active") {
      throw new NotFoundError(`Plugin [${pluginId}] is not active.`, {
        resource: "plugin_engine",
        id: pluginId,
      });
    }
    const plugin = (
      pluginSnapshot as unknown as { context: { plugin?: ArchPlugin } }
    ).context.plugin;

    if (!plugin || !plugin.engine || !plugin.engine.execute) {
      throw new NotFoundError(
        `Plugin [${pluginId}] has no executable engine.`,
        {
          resource: "plugin_engine",
          id: pluginId,
        },
      );
    }

    try {
      return await plugin.engine.execute(params);
    } catch (err: any) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "plugin_engine_crash",
        pluginId,
      });

      throw new APIError(`Plugin computational error: ${err.message || err}`, {
        statusCode: 500,
        context: { pluginId, originalError: err.message || String(err) },
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Sandboxed Lifecycle Event Dispatcher.
   * Triggers plugin background listeners in parallel using parallel settle bounds.
   */
  public async triggerHook(
    hookName: keyof PluginHooks,
    data: any,
  ): Promise<void> {
    await this.loadAllPlugins();

    const snapshot = this.actor.getSnapshot();
    const plugins: ArchPlugin[] = [];

    // Extract plugins from actors
    for (const actor of snapshot.context.plugins.values()) {
      const pluginSnapshot = actor.getSnapshot();
      if (pluginSnapshot.status !== "active") continue;
      const plugin = (
        pluginSnapshot as unknown as { context: { plugin?: ArchPlugin } }
      ).context.plugin;
      if (plugin) {
        plugins.push(plugin);
      }
    }

    const hookPromises = plugins
      .filter((plugin) => plugin.hooks && plugin.hooks[hookName])
      .map(async (plugin) => {
        try {
          const hookFn = plugin.hooks![hookName];
          if (hookFn) {
            await hookFn(data);
          }
        } catch (err: any) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            context: "plugin_hook_crash",
            pluginId: plugin.metadata.id,
            hookName,
          });
        }
      });

    if (hookPromises.length > 0) {
      await Promise.allSettled(hookPromises);
    }
  }

  /**
   * Returns all active, safely verified visual UI widgets injected by plugins.
   */
  public async getActiveWidgets(): Promise<PluginWidget[]> {
    await this.loadAllPlugins();

    const snapshot = this.actor.getSnapshot();
    const widgets: PluginWidget[] = [];

    // Extract widgets from active plugins
    for (const actor of snapshot.context.plugins.values()) {
      const pluginSnapshot = actor.getSnapshot();
      if (pluginSnapshot.status !== "active") continue;
      const plugin = (
        pluginSnapshot as unknown as { context: { plugin?: ArchPlugin } }
      ).context.plugin;

      if (plugin && plugin.widgets && plugin.widgets.length > 0) {
        widgets.push(...plugin.widgets);
      }
    }

    return widgets;
  }

  /**
   * Diagnostics: Get loaded plugin health report
   * Delegates to XState machine health report.
   */
  public getHealthReport(): HealthReport {
    const snapshot = this.actor.getSnapshot();
    return snapshot.context.healthReport;
  }

  /**
   * XState Integration: Get the underlying actor for advanced use
   */
  public getActor(): ActorRefFrom<typeof orchestratorMachine> {
    return this.actor;
  }

  /**
   * XState Integration: Subscribe to orchestrator state changes
   */
  public subscribe(
    callback: (_healthReport: HealthReport) => void,
  ): () => void {
    const sub = this.actor.subscribe((snapshot) => {
      callback(snapshot.context.healthReport);
    });
    return () => sub.unsubscribe();
  }

  /**
   * Retry a failed plugin
   */
  public async retryPlugin(pluginName: string): Promise<void> {
    this.actor.send({ type: "RETRY_PLUGIN", pluginName });
    await new Promise((r) => setTimeout(r, 100)); // Brief wait for retry
  }

  /**
   * Disable a plugin
   */
  public disablePlugin(pluginName: string): void {
    this.actor.send({ type: "DISABLE_PLUGIN", pluginName });
  }

  /**
   * Enable a plugin
   */
  public enablePlugin(pluginName: string): void {
    this.actor.send({ type: "ENABLE_PLUGIN", pluginName });
  }
}

// Export singleton instance
export const pluginOrchestrator = new PluginOrchestrator();
