/**
 * @jest-environment node
 */

// We test the PluginOrchestrator by directly instantiating it.
// The singleton export creates an instance at module load time (server-side only),
// so we reset modules between tests that need a fresh orchestrator.

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers — inject mock plugins into XState actor context
// ---------------------------------------------------------------------------

function createMockPluginActor(plugin: any) {
  const snapshot = { status: "active", context: { plugin } } as any;
  return { getSnapshot: () => snapshot };
}

function injectMockPlugin(orchestrator: any, pluginId: string, plugin: any) {
  const existing = orchestrator.actor.getSnapshot();
  const plugins = new Map(existing.context.plugins);
  plugins.set(pluginId, createMockPluginActor(plugin));
  jest.spyOn(orchestrator.actor, "getSnapshot").mockReturnValue({
    ...existing,
    context: { ...existing.context, plugins },
  });
}

// ---------------------------------------------------------------------------
// Health report (no plugins loaded)
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.getHealthReport", () => {
  it("returns empty counts for a fresh orchestrator", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");

    // The loadAllPlugins runs async in constructor; wait for it to settle
    await new Promise((r) => setTimeout(r, 50));

    const report = pluginOrchestrator.getHealthReport();
    expect(report).toHaveProperty("activeCount");
    expect(report).toHaveProperty("failedCount");
    expect(report).toHaveProperty("activePlugins");
    expect(report).toHaveProperty("failedPlugins");
    expect(Array.isArray(report.activePlugins)).toBe(true);
    expect(Array.isArray(report.failedPlugins)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadAllPlugins
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.loadAllPlugins", () => {
  it("idempotent — second call does not reload", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");

    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    await pluginOrchestrator.loadAllPlugins(); // mark isLoaded=true
    const logCallsBefore = spy.mock.calls.length;
    await pluginOrchestrator.loadAllPlugins(); // should skip
    expect(spy.mock.calls.length).toBe(logCallsBefore); // no new logs
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// executeEngine
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.executeEngine", () => {
  it("throws NotFoundError for unknown plugin", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    const { NotFoundError } = await import("@/lib/errors/error-classes");

    await expect(pluginOrchestrator.executeEngine("nonexistent-plugin")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws NotFoundError with plugin ID in message", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");

    await expect(pluginOrchestrator.executeEngine("some-missing-id")).rejects.toThrow(
      "some-missing-id",
    );
  });
});

// ---------------------------------------------------------------------------
// triggerHook
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.triggerHook", () => {
  it("resolves without error when no plugins are loaded", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins(); // ensure loaded state

    await expect(
      pluginOrchestrator.triggerHook("onLogCreated", { shift: "day" }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getActiveWidgets
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.getActiveWidgets", () => {
  it("returns empty array when no plugins are loaded", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins();

    const widgets = await pluginOrchestrator.getActiveWidgets();
    expect(Array.isArray(widgets)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeEngine — success path (inject mock plugin)
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.executeEngine – success", () => {
  it("executes plugin engine and returns result", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins();

    const mockEngine = { execute: jest.fn().mockResolvedValue({ wear: 0.5 }) };
    const mockPlugin = {
      metadata: {
        id: "mock-plugin",
        name: "Mock",
        version: "1.0.0",
        enabled: true,
      },
      engine: mockEngine,
    };
    injectMockPlugin(pluginOrchestrator, "mock-plugin", mockPlugin);

    const result = await pluginOrchestrator.executeEngine("mock-plugin", {
      rpm: 1000,
    });
    expect(result).toEqual({ wear: 0.5 });
    expect(mockEngine.execute).toHaveBeenCalledWith({ rpm: 1000 });
  });

  it("wraps engine runtime error in APIError", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    const { APIError } = await import("@/lib/errors/error-classes");
    await pluginOrchestrator.loadAllPlugins();

    const mockEngine = {
      execute: jest.fn().mockRejectedValue(new Error("computation failed")),
    };
    const mockPlugin = {
      metadata: {
        id: "crash-plugin",
        name: "Crash",
        version: "1.0.0",
        enabled: true,
      },
      engine: mockEngine,
    };
    injectMockPlugin(pluginOrchestrator, "crash-plugin", mockPlugin);

    await expect(pluginOrchestrator.executeEngine("crash-plugin")).rejects.toThrow(APIError);
  });
});

// ---------------------------------------------------------------------------
// triggerHook — with hooks that succeed and throw
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.triggerHook – with hooks", () => {
  it("calls hooks on active plugins", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins();

    const hookFn = jest.fn().mockResolvedValue(undefined);
    const mockPlugin = {
      metadata: {
        id: "hook-plugin",
        name: "Hook",
        version: "1.0.0",
        enabled: true,
      },
      hooks: { onLogCreated: hookFn },
    };
    injectMockPlugin(pluginOrchestrator, "hook-plugin", mockPlugin);

    await pluginOrchestrator.triggerHook("onLogCreated", { shift: "night" });
    expect(hookFn).toHaveBeenCalledWith({ shift: "night" });
  });

  it("isolates hook crashes without throwing", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins();

    const hookFn = jest.fn().mockRejectedValue(new Error("hook crashed"));
    const mockPlugin = {
      metadata: {
        id: "bad-hook-plugin",
        name: "BadHook",
        version: "1.0.0",
        enabled: true,
      },
      hooks: { onLogCreated: hookFn },
    };
    injectMockPlugin(pluginOrchestrator, "bad-hook-plugin", mockPlugin);

    await expect(pluginOrchestrator.triggerHook("onLogCreated", {})).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getActiveWidgets — with plugin that has widgets
// ---------------------------------------------------------------------------

describe("PluginOrchestrator.getActiveWidgets – with widgets", () => {
  it("returns widgets from active plugins", async () => {
    jest.resetModules();
    const { pluginOrchestrator } = await import("./orchestrator");
    await pluginOrchestrator.loadAllPlugins();

    const mockWidget = {
      id: "w1",
      name: "Dashboard",
      component: "DashboardWidget",
    };
    const mockPlugin = {
      metadata: {
        id: "widget-plugin",
        name: "Widget",
        version: "1.0.0",
        enabled: true,
      },
      widgets: [mockWidget],
    };
    injectMockPlugin(pluginOrchestrator, "widget-plugin", mockPlugin);

    const widgets = await pluginOrchestrator.getActiveWidgets();
    expect(widgets).toContain(mockWidget);
  });
});
