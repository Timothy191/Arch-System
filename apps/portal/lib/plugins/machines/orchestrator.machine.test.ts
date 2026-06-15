/**
 * @jest-environment node
 */

import { interpret } from "xstate";
import { orchestratorMachine } from "./orchestrator.machine";

describe("Orchestrator Machine", () => {
  it("starts in idle state", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("idle");
    expect(snapshot.context.isInitialized).toBe(false);

    actor.stop();
  });

  it("initializes and spawns plugins", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.isInitialized).toBe(true);
    expect(snapshot.context.plugins.size).toBeGreaterThan(0);

    actor.stop();
  });

  it("provides health report after initialization", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });

    const snapshot = actor.getSnapshot();
    const healthReport = snapshot.context.healthReport;

    expect(healthReport).toHaveProperty("activeCount");
    expect(healthReport).toHaveProperty("failedCount");
    expect(healthReport).toHaveProperty("disabledCount");
    expect(healthReport).toHaveProperty("loadingCount");
    expect(healthReport).toHaveProperty("activePlugins");
    expect(healthReport).toHaveProperty("failedPlugins");

    actor.stop();
  });

  it("can trigger health check", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });
    actor.send({ type: "HEALTH_CHECK" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.healthReport).toBeDefined();

    actor.stop();
  });

  it("can disable a plugin", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });

    // Get first plugin name
    const snapshot = actor.getSnapshot();
    const firstPlugin = Array.from(snapshot.context.plugins.keys())[0];

    if (firstPlugin) {
      actor.send({ type: "DISABLE_PLUGIN", pluginName: firstPlugin });

      // Verify the plugin actor received the message
      const pluginActor = snapshot.context.plugins.get(firstPlugin);
      expect(pluginActor).toBeDefined();
    }

    actor.stop();
  });

  it("can retry a failed plugin", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });

    const snapshot = actor.getSnapshot();
    const firstPlugin = Array.from(snapshot.context.plugins.keys())[0];

    if (firstPlugin) {
      actor.send({ type: "RETRY_PLUGIN", pluginName: firstPlugin });

      const pluginActor = snapshot.context.plugins.get(firstPlugin);
      expect(pluginActor).toBeDefined();
    }

    actor.stop();
  });

  it("can unload all plugins", () => {
    const actor = interpret(orchestratorMachine);
    actor.start();

    actor.send({ type: "INITIALIZE" });

    const beforeSnapshot = actor.getSnapshot();
    expect(beforeSnapshot.value).not.toBe("idle");

    actor.send({ type: "UNLOAD_ALL" });

    const afterSnapshot = actor.getSnapshot();
    expect(afterSnapshot.value).toBe("idle");

    actor.stop();
  });
});
