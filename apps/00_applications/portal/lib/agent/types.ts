export type AgentRole = "user" | "assistant" | "system";

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
}

export type AgentSurfaceMode = "integrated" | "browser";

export interface AgentPublicConfig {
  mode: AgentSurfaceMode;
  model: string | null;
  integratedReady: boolean;
  browserProviders: BrowserAgentProvider[];
}

export interface BrowserAgentProvider {
  id: string;
  label: string;
  url: string;
  description: string;
}
