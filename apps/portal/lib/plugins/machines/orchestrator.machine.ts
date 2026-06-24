import { setup, assign, type SnapshotFrom } from "xstate";
import { pluginMachine } from "./plugin.machine";
import { OrchestratorContext, OrchestratorEvent, HealthReport, PluginActor } from "./types";

// =============================================================================
// Default Installed Plugins (matches current orchestrator)
// =============================================================================

const DEFAULT_PLUGINS = ["predictive-maintenance", "rust-telemetry-engine", "buggy-plugin"];

// =============================================================================
// Health Report Computation
// =============================================================================

type PluginSnapshot = SnapshotFrom<typeof pluginMachine>;

function computeHealthReport(plugins: Map<string, PluginActor>): HealthReport {
  const activePlugins: string[] = [];
  const failedPlugins: Array<{ name: string; error: string; at: string }> = [];
  let activeCount = 0;
  let failedCount = 0;
  let disabledCount = 0;
  let loadingCount = 0;

  for (const [name, actor] of plugins.entries()) {
    const snapshot = actor.getSnapshot() as PluginSnapshot;
    const state = snapshot.status === "active" ? (snapshot.value as string) : "idle";
    const context = snapshot.context as { error?: string };

    switch (state) {
      case "active":
        activeCount++;
        activePlugins.push(name);
        break;
      case "failed":
        failedCount++;
        failedPlugins.push({
          name,
          error: context.error ?? "Unknown error",
          at: new Date().toISOString(),
        });
        break;
      case "disabled":
        disabledCount++;
        break;
      case "loading":
      case "retrying":
        loadingCount++;
        break;
    }
  }

  return {
    activeCount,
    failedCount,
    disabledCount,
    loadingCount,
    activePlugins,
    failedPlugins,
  };
}

// =============================================================================
// Orchestrator State Machine
// =============================================================================

export const orchestratorMachine = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvent,
  },
  actions: {
    spawnPlugins: assign({
      plugins: ({ context, spawn }) => {
        const plugins = new Map<string, PluginActor>();

        for (const pluginName of context.pluginConfigs) {
          const actor = spawn(pluginMachine, {
            input: { pluginName, maxRetries: 3 },
          }) as PluginActor;
          plugins.set(pluginName, actor);
        }

        return plugins;
      },
    }),

    loadAllPlugins: ({ context }) => {
      for (const actor of context.plugins.values()) {
        actor.send({ type: "LOAD" });
      }
    },

    updateHealthReport: assign({
      healthReport: ({ context }) => computeHealthReport(context.plugins),
    }),

    markInitialized: assign({
      isInitialized: true,
    }),

    unloadAllPlugins: ({ context }) => {
      for (const actor of context.plugins.values()) {
        actor.send({ type: "UNLOAD" });
      }
    },

    retryPlugin: ({ context, event }) => {
      if (event.type === "RETRY_PLUGIN") {
        const actor = context.plugins.get(event.pluginName);
        if (actor) {
          actor.send({ type: "RETRY" });
        }
      }
    },

    disablePlugin: ({ context, event }) => {
      if (event.type === "DISABLE_PLUGIN") {
        const actor = context.plugins.get(event.pluginName);
        if (actor) {
          actor.send({ type: "DISABLE" });
        }
      }
    },

    enablePlugin: ({ context, event }) => {
      if (event.type === "ENABLE_PLUGIN") {
        const actor = context.plugins.get(event.pluginName);
        if (actor) {
          actor.send({ type: "ENABLE" });
        }
      }
    },
  },
  actors: {},
  guards: {
    allPluginsLoaded: ({ context }) => {
      for (const actor of context.plugins.values()) {
        const snapshot = actor.getSnapshot() as PluginSnapshot;
        const state = snapshot.status === "active" ? (snapshot.value as string) : "idle";
        if (state === "idle" || state === "loading") {
          return false;
        }
      }
      return true;
    },
  },
}).createMachine({
  id: "orchestrator",
  initial: "idle",
  context: {
    plugins: new Map(),
    pluginConfigs: DEFAULT_PLUGINS,
    isInitialized: false,
    healthReport: {
      activeCount: 0,
      failedCount: 0,
      disabledCount: 0,
      loadingCount: 0,
      activePlugins: [],
      failedPlugins: [],
    },
  },
  states: {
    idle: {
      on: {
        INITIALIZE: "initializing",
      },
    },
    initializing: {
      entry: ["spawnPlugins", "markInitialized"],
      always: "loadingPlugins",
    },
    loadingPlugins: {
      entry: ["loadAllPlugins"],
      after: {
        100: {
          target: "active",
          guard: "allPluginsLoaded",
        },
      },
      on: {
        "plugin.stateChanged": {
          actions: ["updateHealthReport"],
        },
        UNLOAD_ALL: {
          target: "idle",
          actions: ["unloadAllPlugins"],
        },
      },
    },
    active: {
      entry: ["updateHealthReport"],
      on: {
        HEALTH_CHECK: {
          actions: ["updateHealthReport"],
        },
        RETRY_PLUGIN: {
          actions: ["retryPlugin", "updateHealthReport"],
        },
        DISABLE_PLUGIN: {
          actions: ["disablePlugin", "updateHealthReport"],
        },
        ENABLE_PLUGIN: {
          actions: ["enablePlugin", "updateHealthReport"],
        },
        UNLOAD_ALL: {
          target: "idle",
          actions: ["unloadAllPlugins"],
        },
        "plugin.stateChanged": {
          actions: ["updateHealthReport"],
        },
      },
    },
    error: {
      on: {
        INITIALIZE: "initializing",
      },
    },
  },
});
