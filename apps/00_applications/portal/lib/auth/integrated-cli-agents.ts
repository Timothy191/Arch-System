/** Integrated CLI coding agents — official marks served from /icons/cli-agents/ (synced from assets/). */

export type IntegratedCliAgent = {
  readonly name: string;
  readonly logoSrc: string;
  readonly logoAlt: string;
  readonly wideLogo?: boolean;
};

export const INTEGRATED_CLI_AGENTS: readonly IntegratedCliAgent[] = [
  {
    name: "Claude Code",
    logoSrc: "/icons/cli-agents/anthropic.svg",
    logoAlt: "Anthropic",
  },
  {
    name: "Aider",
    logoSrc: "/icons/cli-agents/aider-32.png",
    logoAlt: "Aider",
  },
  {
    name: "Antigravity",
    logoSrc: "/icons/cli-agents/antigravity.svg",
    logoAlt: "Google Antigravity",
    wideLogo: true,
  },
  {
    name: "Cursor",
    logoSrc: "/icons/cli-agents/cursor.svg",
    logoAlt: "Cursor",
  },
  {
    name: "Codex CLI",
    logoSrc: "/icons/cli-agents/openai.svg",
    logoAlt: "OpenAI",
  },
  {
    name: "Gemini CLI",
    logoSrc: "/icons/cli-agents/googlegemini.svg",
    logoAlt: "Google Gemini",
  },
  {
    name: "Cline",
    logoSrc: "/icons/cli-agents/cline.svg",
    logoAlt: "Cline",
  },
  {
    name: "OpenCode",
    logoSrc: "/icons/cli-agents/opencode-icon.svg",
    logoAlt: "OpenCode",
  },
  {
    name: "Continue",
    logoSrc: "/icons/cli-agents/continue.svg",
    logoAlt: "Continue",
  },
  {
    name: "Amazon Q Developer",
    logoSrc: "/icons/cli-agents/amazon.svg",
    logoAlt: "Amazon",
  },
] as const;
