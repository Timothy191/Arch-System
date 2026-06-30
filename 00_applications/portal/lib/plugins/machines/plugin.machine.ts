import { setup, assign, fromPromise } from "xstate";
import { ArchPlugin } from "../types";
import { PluginContext, PluginEvent, isRetryableError } from "./types";
import { logError } from "@/lib/errors/error-logger";
import { ValidationError } from "@/lib/errors/error-classes";

// =============================================================================
// Async Load Function
// =============================================================================

async function loadPluginModule(pluginName: string): Promise<ArchPlugin> {
  const module = await import(`../../plugins/${pluginName}/index`);
  const plugin: ArchPlugin = module.default;

  if (!plugin || !plugin.metadata || !plugin.metadata.id) {
    throw new ValidationError(`Plugin ${pluginName} is missing valid metadata contract`, {
      field: "metadata",
      value: pluginName,
    });
  }

  return plugin;
}

// =============================================================================
// Plugin State Machine
// =============================================================================

export const pluginMachine = setup({
  types: {
    context: {} as PluginContext,
    events: {} as PluginEvent,
  },
  actions: {
    logTransition: assign({
      lastLoadedAt: () => Date.now(),
    }),
    logError: ({ context, event }) => {
      if (event.type === "plugin.failed" || event.type === "plugin.invalid") {
        logError(new Error(event.error), {
          context: "plugin_machine",
          pluginName: context.pluginName,
          state: "failed",
        });
      }
    },
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    resetRetry: assign({
      retryCount: 0,
    }),
    storePlugin: assign({
      plugin: ({ event }) => {
        if (event.type === "plugin.loaded") {
          return event.plugin;
        }
        return undefined;
      },
    }),
    storeError: assign({
      error: ({ event }) => {
        if (event.type === "plugin.failed" || event.type === "plugin.invalid") {
          return event.error;
        }
        return undefined;
      },
    }),
    clearError: assign({
      error: undefined,
    }),
  },
  actors: {
    loadPlugin: fromPromise(async ({ input }: { input: { pluginName: string } }) => {
      return loadPluginModule(input.pluginName);
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    isRetryableError: ({ event }) => {
      if (event.type === "plugin.failed") {
        return isRetryableError(event.error);
      }
      return false;
    },
    isEnabled: ({ context }) => {
      return context.plugin?.metadata.enabled ?? false;
    },
  },
}).createMachine({
  id: "plugin",
  initial: "idle",
  context: ({ input }) => ({
    pluginName: (input as { pluginName: string; maxRetries?: number }).pluginName,
    plugin: undefined,
    error: undefined,
    retryCount: 0,
    maxRetries: (input as { pluginName: string; maxRetries?: number }).maxRetries ?? 3,
    lastLoadedAt: undefined,
  }),
  states: {
    idle: {
      on: {
        LOAD: "loading",
        DISABLE: "disabled",
      },
    },
    loading: {
      entry: ["clearError", "logTransition"],
      invoke: {
        src: "loadPlugin",
        input: ({ context }) => ({ pluginName: context.pluginName }),
        onDone: {
          target: "validating",
          actions: assign({
            plugin: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error ? event.error.message : String(event.error),
          }),
        },
      },
    },
    validating: {
      entry: ["resetRetry"],
      always: [
        {
          target: "active",
          guard: "isEnabled",
        },
        {
          target: "disabled",
        },
      ],
    },
    active: {
      entry: ["logTransition"],
      on: {
        UNLOAD: "idle",
        DISABLE: "disabled",
      },
    },
    failed: {
      entry: ["logError"],
      on: {
        RETRY: {
          target: "retrying",
          guard: "canRetry",
          actions: "incrementRetry",
        },
        DISABLE: "disabled",
      },
    },
    retrying: {
      after: {
        1000: "loading",
      },
    },
    disabled: {
      on: {
        ENABLE: "loading",
      },
    },
  },
});
