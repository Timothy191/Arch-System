"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useSplitWindow } from "@/hooks/useSplitWindow";
import { readOpenAiSseStream } from "~/lib/agent/stream";
import type { AgentMessage, AgentPublicConfig, BrowserAgentProvider } from "~/lib/agent/types";

function createMessage(role: AgentMessage["role"], content: string): AgentMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

async function copyPrompt(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ConversationalBar() {
  const transcriptId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const splitWindowOpen = useSplitWindow((s) => s.isOpen);

  const [config, setConfig] = useState<AgentPublicConfig | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserNotice, setBrowserNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/agent/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as AgentPublicConfig;
        setConfig(data);
      } catch {
        // Unauthenticated surfaces hide the bar below
      }
    })();
  }, []);

  useEffect(() => {
    if (!expanded || !transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [expanded, messages, loading]);

  const mode = config?.mode ?? "browser";
  const integratedReady = config?.integratedReady ?? false;

  const sendIntegrated = useCallback(
    async (userText: string) => {
      const userMessage = createMessage("user", userText);
      const assistantPlaceholder = createMessage("assistant", "");
      const nextMessages = [...messages, userMessage];

      setMessages([...nextMessages, assistantPlaceholder]);
      setLoading(true);
      setError(null);
      setExpanded(true);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Agent request failed");
        }

        if (!res.body) {
          throw new Error("Agent stream unavailable");
        }

        let assembled = "";
        await readOpenAiSseStream(res.body, (delta) => {
          assembled += delta;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantPlaceholder.id
                ? { ...message, content: assembled }
                : message,
            ),
          );
        });

        if (!assembled.trim()) {
          throw new Error("Agent returned an empty response");
        }
      } catch (err) {
        setMessages((current) => current.filter((message) => message.id !== assistantPlaceholder.id));
        setError(err instanceof Error ? err.message : "Agent request failed");
      } finally {
        setLoading(false);
      }
    },
    [messages],
  );

  const openBrowserProvider = useCallback(
    async (provider: BrowserAgentProvider, prompt: string) => {
      const copied = await copyPrompt(prompt);
      window.open(provider.url, "_blank", "noopener,noreferrer");
      setBrowserNotice(
        copied
          ? `Prompt copied — paste into ${provider.label} to continue.`
          : `Opened ${provider.label} — retype your prompt if clipboard access was blocked.`,
      );
      setExpanded(true);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      const text = draft.trim();
      if (!text || loading) return;

      setDraft("");
      setBrowserNotice(null);

      if (mode === "integrated" && integratedReady) {
        await sendIntegrated(text);
        return;
      }

      const userMessage = createMessage("user", text);
      setMessages((current) => [...current, userMessage]);
      setExpanded(true);
      setError(null);
    },
    [draft, integratedReady, loading, mode, sendIntegrated],
  );

  if (!config) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-40 pointer-events-none transition-[padding,transform] duration-300 ease-glass",
        "bottom-6 left-1/2 w-[min(100%-1.5rem,48rem)] -translate-x-1/2",
        splitWindowOpen && "translate-x-[calc(-50%-6rem)] sm:translate-x-[calc(-50%-6rem)]",
      )}
    >
      <div
        data-testid="conversational-bar"
        data-chrome-ui="agent-bar"
        className={cn(
          "pointer-events-auto flex flex-col gap-2",
        )}
      >
        {expanded && (
          <div
            id={transcriptId}
            ref={transcriptRef}
            className={cn(
              "layer-dock-brushed shadow-window",
              "rounded-2xl px-3 py-2.5 max-h-56 overflow-y-auto space-y-2",
            )}
          >
            {messages.length === 0 && !browserNotice && (
              <p className="text-[11px] text-[var(--text-muted)] px-1">
                {mode === "integrated"
                  ? "Ask about shifts, departments, fleet status, or production reporting."
                  : "Browser mode — your prompt stays local until you paste it into an external model."}
              </p>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-[12px] leading-relaxed",
                  message.role === "user"
                    ? "bg-black/[0.04] text-[var(--text-heading)]"
                    : "bg-[var(--brand-gold-glow)] text-[var(--text-body)] border border-[var(--brand-gold-border)]",
                )}
              >
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  {message.role === "user" ? "Operator" : "Arch Agent"}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}

            {browserNotice && (
              <p className="text-[11px] text-[var(--brand-gold)] px-1">{browserNotice}</p>
            )}

            {error && <p className="text-[11px] text-[var(--accent-red)] px-1">{error}</p>}

            {mode === "browser" && messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.browserProviders.map((provider) => {
                  const lastUser = [...messages].reverse().find((m) => m.role === "user");
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      disabled={!lastUser}
                      onClick={() => {
                        if (lastUser) void openBrowserProvider(provider, lastUser.content);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]",
                        "brand-chrome-pill text-[var(--text-secondary)] hover:text-[var(--text-heading)]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {provider.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className={cn(
            "layer-dock-brushed flex items-center gap-2",
            "rounded-full px-2 py-1.5 shadow-window",
          )}
        >
          <button
            type="button"
            aria-label={expanded ? "Collapse agent panel" : "Expand agent panel"}
            onClick={() => setExpanded((value) => !value)}
            className="brand-chrome-orb w-8 h-8 shrink-0 flex items-center justify-center"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--brand-silver)]" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-[var(--brand-silver)]" />
            )}
          </button>

          <div className="flex items-center gap-1.5 shrink-0 pl-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--brand-gold)]" />
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-widest text-[var(--brand-gold)]">
              {mode === "integrated" ? "Integrated" : "Browser"}
            </span>
          </div>

          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Ask Arch Agent about shifts, fleet, or reports…"
            aria-label="Ask Arch Agent"
            aria-controls={expanded ? transcriptId : undefined}
            disabled={loading}
            className={cn(
              "flex-1 min-w-0 h-8 lg:h-9 bg-transparent border-0 outline-none",
              "text-[12px] lg:text-[13px] text-[var(--text-heading)] placeholder:text-[var(--brand-silver-muted)]",
            )}
          />

          <button
            type="submit"
            disabled={loading || draft.trim().length === 0}
            aria-label="Send to Arch Agent"
            className={cn(
              "brand-chrome-pill h-8 px-3 shrink-0 inline-flex items-center gap-1.5",
              "text-[11px] font-medium text-[var(--text-heading)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="w-3.5 h-3.5 text-[var(--brand-gold)]" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
