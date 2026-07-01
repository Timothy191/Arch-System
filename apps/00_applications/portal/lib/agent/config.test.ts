import {
  getAgentPublicConfig,
  isIntegratedAgentReady,
  resolveAgentSurfaceMode,
} from "./config";

describe("agent config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.ARCH_AGENT_API_URL;
    delete process.env.ARCH_AGENT_API_KEY;
    delete process.env.ARCH_AGENT_MODE;
  });

  afterAll(() => {
    process.env = env;
  });

  it("defaults to browser mode when API is not configured", () => {
    expect(isIntegratedAgentReady()).toBe(false);
    expect(resolveAgentSurfaceMode()).toBe("browser");
    expect(getAgentPublicConfig().mode).toBe("browser");
  });

  it("uses integrated mode when API credentials are set", () => {
    process.env.ARCH_AGENT_API_URL = "https://api.groq.com/openai/v1";
    process.env.ARCH_AGENT_API_KEY = "test-key";

    expect(isIntegratedAgentReady()).toBe(true);
    expect(resolveAgentSurfaceMode()).toBe("integrated");
    expect(getAgentPublicConfig().model).toBeTruthy();
  });

  it("honours explicit browser mode even when integrated is ready", () => {
    process.env.ARCH_AGENT_API_URL = "https://api.groq.com/openai/v1";
    process.env.ARCH_AGENT_API_KEY = "test-key";
    process.env.ARCH_AGENT_MODE = "browser";

    expect(resolveAgentSurfaceMode()).toBe("browser");
  });
});
