import type { AgentPublicConfig, AgentSurfaceMode, BrowserAgentProvider } from "./types";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const BROWSER_AGENT_PROVIDERS: BrowserAgentProvider[] = [
  {
    id: "groq",
    label: "Groq",
    url: "https://chat.groq.com/",
    description: "Fast open models — good default for ops Q&A",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    url: "https://chat.openai.com/",
    description: "General reasoning and document drafting",
  },
  {
    id: "claude",
    label: "Claude",
    url: "https://claude.ai/",
    description: "Long-context analysis and structured reports",
  },
];

function resolveRequestedMode(): AgentSurfaceMode | "auto" {
  const raw = process.env.ARCH_AGENT_MODE?.trim().toLowerCase();
  if (raw === "integrated" || raw === "browser") return raw;
  return "auto";
}

export function isIntegratedAgentReady(): boolean {
  const apiUrl = process.env.ARCH_AGENT_API_URL?.trim();
  const apiKey = process.env.ARCH_AGENT_API_KEY?.trim();
  return Boolean(apiUrl && apiKey);
}

export function resolveAgentSurfaceMode(): AgentSurfaceMode {
  const requested = resolveRequestedMode();
  if (requested === "integrated") {
    return isIntegratedAgentReady() ? "integrated" : "browser";
  }
  if (requested === "browser") {
    return "browser";
  }
  return isIntegratedAgentReady() ? "integrated" : "browser";
}

export function getAgentModel(): string {
  return process.env.ARCH_AGENT_MODEL?.trim() || DEFAULT_MODEL;
}

export function getAgentApiUrl(): string {
  return process.env.ARCH_AGENT_API_URL?.trim() || "https://api.groq.com/openai/v1";
}

export function getAgentApiKey(): string | undefined {
  return process.env.ARCH_AGENT_API_KEY?.trim() || undefined;
}

export function getAgentPublicConfig(): AgentPublicConfig {
  const integratedReady = isIntegratedAgentReady();
  const mode = resolveAgentSurfaceMode();

  return {
    mode,
    model: integratedReady ? getAgentModel() : null,
    integratedReady,
    browserProviders: BROWSER_AGENT_PROVIDERS,
  };
}

export const ARCH_AGENT_SYSTEM_PROMPT = `You are Arch Agent, the operational assistant embedded in Arch mining control systems.
Answer in direct, industrial language suitable for shift supervisors and control-room operators.
Prioritize shift logs, fleet status, production reporting, breakdown notes, and department workflows.
If context is missing, state what is needed before proceeding.`;
