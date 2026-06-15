import { systemPrompts } from "./prompts";

describe("systemPrompts.chat", () => {
  it("returns base prompt when no context or memory provided", () => {
    const result = systemPrompts.chat();
    expect(result).toContain("Arch-Systems");
    expect(result).toContain("industrial operations");
    expect(result).not.toContain("context from past conversations");
    expect(result).not.toContain("Current operational context");
  });

  it("includes memory context section when memoryContext provided", () => {
    const result = systemPrompts.chat(
      undefined,
      "Previous: machine XR-1 last serviced 3 months ago",
    );
    expect(result).toContain("context from past conversations");
    expect(result).toContain("machine XR-1 last serviced");
    expect(result).toContain("personalize your response");
  });

  it("includes operational context section when context provided", () => {
    const result = systemPrompts.chat("control-room shift handoff");
    expect(result).toContain(
      "Current operational context: control-room shift handoff",
    );
    expect(result).not.toContain("context from past conversations");
  });

  it("includes both sections when both are provided", () => {
    const result = systemPrompts.chat("drilling dept", "past: bit depth 1240m");
    expect(result).toContain("past: bit depth 1240m");
    expect(result).toContain("Current operational context: drilling dept");
  });

  it("memory context appears before operational context", () => {
    const result = systemPrompts.chat("dept-ctx", "memory-ctx");
    const memoryIdx = result.indexOf("memory-ctx");
    const ctxIdx = result.indexOf("dept-ctx");
    expect(memoryIdx).toBeLessThan(ctxIdx);
  });
});

describe("systemPrompts static templates", () => {
  it("predictiveMaintenance instructs JSON output", () => {
    expect(systemPrompts.predictiveMaintenance).toContain("JSON");
    expect(systemPrompts.predictiveMaintenance).toContain("maintenance");
  });

  it("safetyCompliance instructs JSON output", () => {
    expect(systemPrompts.safetyCompliance).toContain("JSON");
    expect(systemPrompts.safetyCompliance).toContain("safety");
  });

  it("shiftHandoff focuses on shift summary", () => {
    expect(systemPrompts.shiftHandoff).toContain("shift");
    expect(systemPrompts.shiftHandoff).toContain("next shift");
  });

  it("all static templates are non-empty strings", () => {
    const staticPrompts = [
      systemPrompts.predictiveMaintenance,
      systemPrompts.safetyCompliance,
      systemPrompts.shiftHandoff,
    ];
    for (const prompt of staticPrompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
